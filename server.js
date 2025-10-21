// server.js


const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const connectDB = require("./db");

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

let db;

// Função principal que conecta ao banco e só inicia o servidor depois
(async () => {
  try {
    db = await connectDB();
    if (!db) throw new Error("Falha ao conectar no MongoDB.");

    console.log("✅ Banco de dados conectado com sucesso");

    // Middleware: bloqueia requisições se DB não estiver pronto
    app.use((req, res, next) => {
      if (!db) return res.status(503).json({ error: "Banco de dados ainda não conectado" });
      next();
    });

    // Rotas
    app.get("/premios", async (req, res) => {
      const shows = await db.collection("reality_shows")
        .find({}, { projection: { nome: 1, "participantes.nome": 1, "participantes.premios": 1 } })
        .toArray();
      res.json(shows);
    });

    app.get("/idade/:nome_reality", async (req, res) => {
      const nome = req.params.nome_reality;
      const show = await db.collection("reality_shows").findOne({ nome });
      if (!show) return res.status(404).json({ error: "Reality não encontrado" });
      const participantes = show.participantes;
      const maisNovo = participantes.reduce((a, b) => (a.idade < b.idade ? a : b));
      const maisVelho = participantes.reduce((a, b) => (a.idade > b.idade ? a : b));
      res.json({ reality: nome, maisNovo, maisVelho });
    });

    app.get("/maior/:valor", async (req, res) => {
      const valor = parseFloat(req.params.valor);
      const shows = await db.collection("reality_shows").aggregate([
        { $unwind: "$participantes" },
        { $unwind: "$participantes.premios" },
        { $match: { "participantes.premios.valor": { $gte: valor } } },
        { $project: { _id: 0, emissora: 1, nome: 1, participante: "$participantes.nome", premio: "$participantes.premios" } }
      ]).toArray();
      res.json(shows);
    });

    app.get("/total", async (req, res) => {
      const total = await db.collection("reality_shows").aggregate([
        { $unwind: "$participantes" },
        { $unwind: "$participantes.premios" },
        { $group: { _id: "$nome", totalPremios: { $sum: "$participantes.premios.valor" } } },
        { $project: { _id: 0, reality: "$_id", totalPremios: 1 } }
      ]).toArray();
      res.json(total);
    });

    app.get("/audiencia", async (req, res) => {
      const audiencia = await db.collection("reality_shows").aggregate([
        { $group: { _id: "$emissora", totalPontos: { $sum: "$audiencia_pontos" } } },
        { $project: { _id: 0, emissora: "$_id", totalPontos: 1 } }
      ]).toArray();
      res.json(audiencia);
    });

    app.post("/votar", async (req, res) => {
  try {
    const { reality, participante } = req.body;
    const db = await connectDB();
    const col = db.collection("reality_shows");

    // procura o reality pelo nome
    const realityShow = await col.findOne({ nome: reality });
    if (!realityShow) {
      return res.status(404).json({ error: "Reality não encontrado" });
    }

    // tenta encontrar o participante dentro do array
    const participanteExistente = realityShow.participantes.find(
      (p) => p.nome.toLowerCase() === participante.toLowerCase()
    );

    if (participanteExistente) {
      // participante já existe → incrementa o total_votos
      await col.updateOne(
        { nome: reality, "participantes.nome": participanteExistente.nome },
        { $inc: { "participantes.$.total_votos": 1 } }
      );
    } else {
      // participante novo → adiciona com 1 voto
      await col.updateOne(
        { nome: reality },
        {
          $push: {
            participantes: {
              id: Date.now(),
              nome: participante,
              idade: 0,
              total_votos: 1,
              eliminado: false,
              premios: []
            }
          }
        }
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Erro ao votar:", err);
    res.status(500).json({ error: "Erro ao registrar voto" });
  }
});
    // ROTA: GET /votos/:reality
app.get("/votos/:reality", async (req, res) => {
  try {
    const { reality } = req.params;
    const db = await connectDB();
    const col = db.collection("reality_shows");

    const show = await col.findOne({ nome: reality });
    if (!show) return res.status(404).json({ error: "Reality não encontrado" });

    const participantes = show.participantes.map((p) => ({
      nome: p.nome,
      total_votos: p.total_votos || 0
    }));

    res.json(participantes);
  } catch (err) {
    console.error("Erro ao buscar votos:", err);
    res.status(500).json({ error: "Erro ao buscar votos" });
  }
});

    const PORT = 3000;
    app.listen(PORT, () => console.log(`🚀 Servidor rodando em http://localhost:${PORT}`));

  } catch (err) {
    console.error("❌ Erro ao inicializar o servidor:", err);
  }
})();
