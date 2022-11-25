//all requires
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

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
const productsCollection = secondSellDb.collection("products");

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
        // app.get("/users", verifyJwt, async (req, res) => {
        //     const email = req.decoded.email;
        //     // const currentEmail = req.query.email;
        //     const query = { email: email };
        //     const user = await userCollection.find(query);
        //     res.send(user);

        //     res.send({ ackwnodege: false, message: "unauthorized" });
        // });
        // get product by category
        app.get("/products", async (req, res) => {
            const category = req.query.category;

            let query = {};
            if (category) {
                query = { category: category };
            }
            const result = await productsCollection.find(query).toArray();
            res.send(result);
        });

        // booked products
        app.put("/products", verifyJwt, async (req, res) => {
            const buyerEmail = req.decoded.email;
            const id = req.query.id;
            const bookedData = req.body;
            const queryInUser = { email: buyerEmail };

            const isUser = await userCollection.findOne(queryInUser);
            if (!isUser) {
                console.log("user not find in db line79");
                return res.send({ acknowledged: false, message: "you are not our user" });
            }
            const queryInProducts = { _id: ObjectId(id) };
            const idByProducts = await productsCollection.findOne(queryInProducts);

            const queryByBuyersEmail = idByProducts?.bookedData?.buyerEmail === buyerEmail;
            if (queryByBuyersEmail) {
                return res.send({ acknowledged: false, message: `you already booking ${idByProducts.name}` });
            }
            if (idByProducts?.bookedData) {
                return res.send({ acknowledged: false, message: `${idByProducts.name} Already booked ` });
            }
            const updateDoc = { $set: { bookedData } };
            const booking = await productsCollection.updateOne(queryInProducts, updateDoc);
            res.send(booking);
        });
        // get booking products
        app.get("bookingProducts", verifyJwt, async (req, res) => {
            const email = req.decoded.email;
            console.log(email);
            const query = {
                bookedData: {
                    buyerEmail: email,
                },
            };
            g;
            console.log(query);
            const isUser = await userCollection.findOne(query);
            if (!isUser) {
                console.log("line-112", isUser);
                return res.send({ acknowledged: false, message: "you are not our user" });
            }
            const userBookingData = await productsCollection.find(query);
            console.log(userBookingData);
            res.send(userBookingData);
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
