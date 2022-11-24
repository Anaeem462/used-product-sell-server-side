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
app.unsubscribe(express.json());

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

//listener
app.get("/", (req, res) => {
    res.send("2nd sell server");
});

app.listen(port, () => {
    client.connect((err) => {
        // console.log(err);
    });
    console.log("server is running with mongodb on ", port);
});
