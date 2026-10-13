import express from "express";
import routes from "./routes.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use("/notes", routes);

// error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Terjadi kesalahan pada server" });
});

app.listen(PORT, () => console.log(`Server berjalan di port ${PORT}`));
