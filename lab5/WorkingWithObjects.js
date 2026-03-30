const assignment = {
    id: 1, title: "NodeJS Assignment",
    description: "Create a NodeJS server with ExpressJS",
    due: "2021-10-10", completed: false, score: 0,
};

/** Lab module (course unit), separate from Node's `module` export concept */
const courseModule = {
    id: "MOD4550-01",
    name: "Web Development Stack",
    description: "Node, Express, React, and Next.js integration",
    course: "CS4550",
};

export default function WorkingWithObjects(app) {
    const getAssignment = (req, res) => {
        res.json(assignment);
    };
    const getAssignmentTitle = (req, res) => {
        res.json(assignment.title);
    };
    app.get("/lab5/assignment/title", getAssignmentTitle);
    const setAssignmentTitle = (req, res) => {
        const { newTitle } = req.params;
        assignment.title = newTitle;
        res.json(assignment);
    };
    app.get("/lab5/assignment/title/:newTitle", setAssignmentTitle);

    const setAssignmentScore = (req, res) => {
        const { newScore } = req.params;
        assignment.score = Number.parseInt(newScore, 10);
        res.json(assignment);
    };
    app.get("/lab5/assignment/score/:newScore", setAssignmentScore);

    const setAssignmentCompleted = (req, res) => {
        const { completed } = req.params;
        assignment.completed = completed === "true";
        res.json(assignment);
    };
    app.get("/lab5/assignment/completed/:completed", setAssignmentCompleted);

    const getModule = (req, res) => {
        res.json(courseModule);
    };
    const getModuleName = (req, res) => {
        res.json(courseModule.name);
    };
    const setModuleName = (req, res) => {
        const { newName } = req.params;
        courseModule.name = newName;
        res.json(courseModule);
    };
    const setModuleDescription = (req, res) => {
        const { newDescription } = req.params;
        courseModule.description = newDescription;
        res.json(courseModule);
    };

    app.get("/lab5/module", getModule);
    app.get("/lab5/module/name", getModuleName);
    app.get("/lab5/module/name/:newName", setModuleName);
    app.get("/lab5/module/description/:newDescription", setModuleDescription);

    app.get("/lab5/assignment", getAssignment);
}
