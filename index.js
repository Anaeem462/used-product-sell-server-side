//all requires
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
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
const ordersCollection = secondSellDb.collection("orders");
const paymentsCollection = secondSellDb.collection("payments");

async function run() {
    try {
        app.get("/adminusers", verifyJwt, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const userData = await userCollection.findOne(query);
            res.send(userData);
        });

        app.put("/setUser", async (req, res) => {
            const user = req.body;
            const query = { email: req.query.email };
            const token = jwt.sign({ email: user.email }, process.env.USER_TOKEN, { expiresIn: "1d" });
            const isAlreadyUser = await userCollection.findOne(query);
            if (isAlreadyUser) {
                return res.send({ result: { acknowledged: false, message: "already in user" }, token });
            }
            const updateDoc = { $set: user };
            const options = { upsert: true };
            const result = await userCollection.updateOne(query, updateDoc, options);
            // send jwt token in cleint side

            // console.log(user, result, token);
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
                query = { category: category, payment: { $ne: "paid" } };
            }

            const products = await productsCollection.find(query).toArray();

            res.send(products);
        });
        app.get("/myproducts", verifyJwt, async (req, res) => {
            const email = req.decoded.email;
            const query = { seller_email: email };
            const result = await productsCollection.find(query).toArray();
            res.send(result);
        });
        app.delete("/myproducts", verifyJwt, async (req, res) => {
            const id = req.query.id;
            const query = { _id: ObjectId(id) };
            const result = await productsCollection.deleteOne(query);
            res.send(result);
        });
        // booked products
        app.put("/orders", verifyJwt, async (req, res) => {
            const buyerEmail = req.decoded.email;
            const id = req.query.id;
            const bookedData = req.body;
            const queryInUser = { email: buyerEmail };

            const isUser = await userCollection.findOne(queryInUser);
            if (!isUser) {
                console.log("user not find in db line79");
                return res.send({ acknowledged: false, message: "you are not our user" });
            }
            const queryByProduct = { productId: id };
            const isAlreadyBooked = await ordersCollection.findOne(queryByProduct);
            if (isAlreadyBooked) {
                return res.send({ acknowledged: false, message: `${isAlreadyBooked.productName} Already booked ` });
            }
            const updateDoc = { $set: bookedData };
            const options = { upsert: true };
            const booking = await ordersCollection.updateOne(queryByProduct, updateDoc, options);
            res.send(booking);
        });
        // get booking products
        app.get("/userOrders", verifyJwt, async (req, res) => {
            const email = req.decoded.email;
            const query = { buyerEmail: email };
            const result = await ordersCollection.find(query).toArray();

            res.send(result);
        });
        app.delete("/products", verifyJwt, async (req, res) => {
            const email = req.decoded.email;
            const id = req.query.id;
            const query = { _id: ObjectId(id) };
            const result = await ordersCollection.deleteOne(query);

            res.send(result);
        });
        // save products
        app.post("/products", verifyJwt, async (req, res) => {
            const email = req.decoded.email;
            const queryByEmail = { email: email, role: "host" };
            const isHost = await userCollection.findOne(queryByEmail);
            if (!isHost) {
                return res.send({ acknowledged: false, message: "you are not a host" });
            }
            const data = req.body;
            const result = await productsCollection.insertOne(data);

            res.send(result);
        });
        /// for payment get product data
        app.get("/products/:id", verifyJwt, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const product = await ordersCollection.findOne(query);
            res.send(product);
        });

        app.post("/create-payment-intent", async (req, res) => {
            const { productPrice } = req.body;

            console.log(productPrice);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: productPrice * 100,
                currency: "usd",
                payment_method_types: ["card"],
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });
        app.post("/payments", verifyJwt, async (req, res) => {
            const data = req.body;

            const options = { upsert: true };
            const productQuery = { _id: ObjectId(data.productId) };
            const updateProductDoc = { $set: { payment: "paid" } };
            const productResult = await productsCollection.updateOne(productQuery, updateProductDoc, options);

            const orderQuery = { _id: ObjectId(data.ordersId) };
            const ordersResult = await ordersCollection.updateOne(orderQuery, updateProductDoc, options);

            const query = { ordersId: data.ordersId, productId: data.productId };
            const updateDoc = { $set: data };

            const result = await paymentsCollection.updateOne(query, updateDoc, options);
            console.log({ productResult, ordersResult, result });
            res.send({ productResult, ordersResult, result });
        });

        app.get("/allbuyers", verifyJwt, async (req, res) => {
            const query = { role: "user" };
            const result = await userCollection.find(query).toArray();
            res.send(result);
        });
        app.get("/allsellers", verifyJwt, async (req, res) => {
            const query = { role: "host" };
            const result = await userCollection.find(query).toArray();
            res.send(result);
        });
        app.delete("/user", verifyJwt, async (req, res) => {
            const id = req.query.id;
            const query = { _id: ObjectId(id) };
            const result = await userCollection.deleteOne(query);
            res.send(result);
        });
        app.put("/user", verifyJwt, async (req, res) => {
            const id = req.query.id;
            const doc = req.body;

            const query = { _id: ObjectId(id) };
            const updateDoc = { $set: doc };
            const options = { upsert: true };
            const result = await userCollection.updateOne(query, updateDoc, options);
            res.send(result);
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
