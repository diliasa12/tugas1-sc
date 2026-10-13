import repo from "./repositories.js";

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

const getAll = wrap(async (req, res) => {
  res.json(await repo.findAll());
});

const getOne = wrap(async (req, res) => {
  const note = await repo.findById(req.params.id);
  if (!note) return res.status(404).json({ message: "Note tidak ditemukan" });
  res.json(note);
});

const create = wrap(async (req, res) => {
  const { title, content = "" } = req.body;
  if (!title) return res.status(400).json({ message: "title wajib diisi" });
  const note = await repo.create({ title, content });
  res.status(201).json(note);
});

const update = wrap(async (req, res) => {
  const { title, content = "" } = req.body;
  if (!title) return res.status(400).json({ message: "title wajib diisi" });
  const note = await repo.update(req.params.id, { title, content });
  if (!note) return res.status(404).json({ message: "Note tidak ditemukan" });
  res.json(note);
});

const remove = wrap(async (req, res) => {
  const deleted = await repo.remove(req.params.id);
  if (!deleted)
    return res.status(404).json({ message: "Note tidak ditemukan" });
  res.status(204).send();
});

export { getAll, getOne, create, update, remove };
