const { after, before, beforeEach } = require("node:test");
const { seedTickets, seedUsers } = require("./fixtures");
const { startServer } = require("./server");

let server;

const setup = ({ withTickets = true } = {}) => {
  before(async () => {
    server = await startServer({
      seedUsers: async (dataDir) => {
        await seedUsers(dataDir);
        if (withTickets) seedTickets(dataDir);
      }
    });
  });

  if (withTickets) {
    beforeEach(() => {
      seedTickets(server.dataDir);
    });
  }

  after(async () => {
    if (!server) return;
    await server.close();
    server = null;
  });
};

const getServer = () => {
  if (!server) throw new Error("Test server is not running.");
  return server;
};

module.exports = { getServer, setup };
