//all requires
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion } = require("mongodb");

//function call
const app = express();
const port = process.env.PORT || 5000;

// all middleware
app.use(cors());
app.use(express.json());

//verify user with jwt token

function verifyJwt(req, res, next) {
    const userTokens = req.headers.authorization;
    if (!userTokens) {
        return res.status(401).send("Unauthorized access");
    }
    jwt.verify(userTokens, process.env.USER_TOKEN, (err, decoded) => {
        if (err) {
            return res.status(403).send("unauthorized user");
        }
        req.decoded = decoded;
        next();
    });
}

// mongodb connect
const uri = process.env.DB_URL;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
const secondSellDb = client.db("2nd-Sell");
const userCollection = secondSellDb.collection("users");

async function run() {
    try {
        app.put("/setUser", async (req, res) => {
            const user = req.body;
            const query = { email: req.query.email };
            const updateDoc = { $set: user };
            const options = { upsert: true };
            const result = await userCollection.updateOne(query, updateDoc, options);
            // send jwt token in cleint side
            const token = jwt.sign({ email: user.email }, process.env.USER_TOKEN, { expiresIn: "1d" });
            console.log(user, result, token);
            res.send({ result, token });
        });

        //listener
        app.get("/", (req, res) => {
            res.send("2nd sell server");
        });
    } finally {
    }
}
run().catch((err) => console.log(err));
app.listen(port, () => {
    client.connect((err) => {
        // console.log(err);
    });
    console.log("server is running with mongodb on ", port);
});
