import { InvernaderoModel } from "./models/InvernaderoModel.js";
import { InvernaderoView } from "./views/InvernaderoView.js";
import { InvernaderoController } from "./controllers/InvernaderoController.js";

document.addEventListener("DOMContentLoaded", () => {
  const model = new InvernaderoModel();
  const view = new InvernaderoView();
  new InvernaderoController(model, view);
});