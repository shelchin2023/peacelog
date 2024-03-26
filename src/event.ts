import { Database } from "bun:sqlite";
import { http, createPublicClient, formatEther } from "viem";
import { endurance_mainnet } from "@/config/chains/endurance_mainnet";
import PeACEAbi from "@/config/abi/PeACEAbi";
import { PromisePool } from "@supercharge/promise-pool";

function replacer(key: any, value: any) {
  if (typeof value === "bigint") {
    return value.toString();
  } else {
    return value;
  }
}
// 并发 10个 ，同一个 IP 不会被限制。
// 17:35 开始  17:40 5分钟 追赶到 773个块  159462n
//

const db = new Database(
  "/Users/shelchin/workspace/docker-apps/metabase-data/peacelog/mydb.sqlite",
  { create: true }
);
const publicClient = createPublicClient({
  chain: endurance_mainnet,
  transport: http(),
});

const blockNumber = await publicClient.getBlockNumber();

// 158689 Mar 26 2024 15:00:00 PM (+08:00 UTC)
// 20:05

const fromBlock = 158689n; //Mar 26 2024 14:55:24 PM (+08:00 UTC)
const finishedBlock = fromBlock + 21600n + 10n;
const toBlock = blockNumber < finishedBlock ? blockNumber : finishedBlock; // fromBlock + 21600n + 10n; //Mar 29 2024 14:00:00 AM (+08:00 UTC)

// // // 创建表
// const query = db.query(
//   "create table events (id integer primary key,  blockNumber integer,timestamp integer, address text, transactionHash text, eventName text ,user text, amount text,amountFormat integer)"
// );
// query.run();
// 创建表
// const query = db.query(
//   "create table block (id integer primary key,  blockNumber integer, event json  )"
// );

// query.run();
// // console.log(db.query("select * from logs LIMIT 1").get());

// 查询是否存在

const writeLog = async (blockNumber: bigint) => {
  // 检查是否写入DB,根据 transactionHash 来检查是否已经写入
  const result = db
    .query(`SELECT * FROM events WHERE blockNumber = ${blockNumber} LIMIT 1;`)
    .get();

  // console.log({result})
  if (result == null) {
    console.log(blockNumber, "null");
    const block = await publicClient.getBlock({ blockNumber });

    const events = await publicClient.getContractEvents({
      abi: PeACEAbi,
      address: "0x62eC3e784285F836299aa77417BDbdC9A65EdcF1",
      eventName: "Deposit",
      fromBlock: blockNumber,
      toBlock: blockNumber,
    });

    const insertEvent = db.prepare(
      "INSERT INTO events (blockNumber,timestamp,address,transactionHash,eventName, user,amount,amountFormat) VALUES (?,?,?,?,?,?,?,?)"
    );
    const insertEvents = db.transaction((events) => {
      for (const event of events)
        insertEvent.run(
          blockNumber,
          block.timestamp,
          "0x62eC3e784285F836299aa77417BDbdC9A65EdcF1",
          event.transactionHash,
          event.eventName,
          event.args.user,
          event.args.amount.toString(),
          parseFloat(formatEther(event.args.amount))
        );

      //   console.log(events);
      return events.length;
    });

    const count = insertEvents(events);
    console.log("count =>", count);
  } else {
    console.log(blockNumber, "not null");
  }
};

const blockNumbers = Array.from(
  { length: Number(toBlock - fromBlock) + 1 },
  (_, i) => fromBlock + BigInt(i)
);

const { results, errors } = await PromisePool.for(blockNumbers)
  .handleError(async (error, user) => {
    console.log(error, user);
  })
  .withConcurrency(10)
  .process(async (num) => {
    return await writeLog(num);
  });

console.log("results len =>", results.length);
console.log("errors len =>", errors.length);
