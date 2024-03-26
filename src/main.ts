import { Database } from "bun:sqlite";
import { http, createPublicClient, formatEther } from "viem";
import { endurance_mainnet } from "@/config/chains/endurance_mainnet";
import PeACEAbi from "@/config/abi/PeACEAbi";
import { PromisePool } from "@supercharge/promise-pool";

const db = new Database(process.env.dbPath!, { create: true });
console.log(process.env.dbPath);

const publicClient = createPublicClient({
  chain: endurance_mainnet,
  transport: http(),
});

// 创建表
const query = db.query(
  "create table  IF NOT EXISTS  events (id integer primary key,  blockNumber integer,timestamp integer, address text, transactionHash text UNIQUE, eventName text ,user text, amount text,amountFormat integer, createdAt integer)"
);
query.run();

const writeLog = async (blockNumber: bigint) => {
  const result = db
    .query(`SELECT * FROM events WHERE blockNumber = ${blockNumber} LIMIT 1;`)
    .get();

  if (result == null) {
    console.log(
      blockNumber,
      "null",
      `SELECT * FROM events WHERE blockNumber = ${blockNumber} LIMIT 1;`
    );
    const block = await publicClient.getBlock({ blockNumber });
    const events = await publicClient.getContractEvents({
      abi: PeACEAbi,
      address: "0x62eC3e784285F836299aa77417BDbdC9A65EdcF1",
      eventName: "Deposit",
      fromBlock: blockNumber,
      toBlock: blockNumber,
    });

    const insertEvent = db.prepare(
      "INSERT INTO events (blockNumber,timestamp,address,transactionHash,eventName, user,amount,amountFormat,createdAt) VALUES (?,?,?,?,?,?,?,?,?)"
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
          parseFloat(formatEther(event.args.amount)),
          Date.now()
        );
      return events.length;
    });

    if (events.length == 0) {
      const count = insertEvents([
        {
          transactionHash: blockNumber,
          eventName: "None",
          args: {
            user: "0x",
            amount: "0",
          },
        },
      ]);
      return count;
    } else {
      const count = insertEvents(events);
      return count;
    }
  }
};

let isruning = false;
const run = async () => {
  isruning = true;
  try {
    const blockNumber = await publicClient.getBlockNumber();

    const fromBlock = 158689n; //Mar 26 2024 14:55:24 PM (+08:00 UTC)
    const finishedBlock = fromBlock + 21600n + 10n;
    const toBlock = blockNumber < finishedBlock ? blockNumber : finishedBlock; // fromBlock + 21600n + 10n; //Mar 29 2024 14:00:00 AM (+08:00 UTC)

    const blockNumbers = Array.from(
      { length: Number(toBlock - fromBlock) + 1 },
      (_, i) => fromBlock + BigInt(i)
    );

    const { results, errors } = await PromisePool.for(blockNumbers)
      .handleError(async (error, user) => {
        console.log(error, user);
      })
      .withConcurrency(10)
      .process(writeLog);

    console.log("blockNumbers =>", blockNumbers);
    console.log("results len =>", results.length);
    console.log("errors len =>", errors.length);
    isruning = false;
  } catch (e) {
    console.log("run =>", e);
    isruning = false;
  }
};

run();
publicClient.watchBlocks({
  onBlock: async (block) => {
    if (isruning == false) {
      console.log(block.number, "watchBlocks");
      run();
    } else {
      return;
    }
  },
});
