import PathParameters from './PathParameters.js';
import QueryParameters from './QueryParameters.js';
import WorkingWithObjects from './WorkingWithObjects.js';
import WorkingWithArrays from './WorkingWithArrays.js';
export default function Lab5(app) {
    const welcome = (req, res) => {
      res.send("Welcome to Lab 5");
    };
    app.get("/lab5/welcome", welcome);
    PathParameters(app);
    QueryParameters(app);
    WorkingWithObjects(app);
    WorkingWithArrays(app);
  }
