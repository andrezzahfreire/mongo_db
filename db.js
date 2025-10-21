// db.js
require('dotenv').config();

const { MongoClient, ServerApiVersion } = require("mongodb");

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: ServerApiVersion.v1,
  tlsAllowInvalidCertificates: true, // apenas se precisar
  connectTimeoutMS: 10000
});

async function connectDB() {
  try {
    await client.connect();
    console.log("✅ Conectado ao MongoDB Atlas com sucesso");
    return client.db("reality_show");
  } catch (err) {
    console.error("❌ Erro ao conectar no MongoDB:", err);
  }
}

module.exports = connectDB;
