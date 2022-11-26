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

//create mongodb database and collections

const secondSellDb = client.db("2nd-Sell");
const userCollection = secondSellDb.collection("users");
const productsCollection = secondSellDb.collection("products");
const ordersCollection = secondSellDb.collection("orders");
const paymentsCollection = secondSellDb.collection("payments");

async function run() {
    try {
        //----------------------verify admin----------------
        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const adminquery = { email: decodedEmail };

            const userData = await userCollection.findOne(adminquery);

            if (userData?.role !== "admin") {
                return res.send({ message: "You are not an admin" });
            }
            next();
        };
        //------------------------verify host------------------
        const verifyHost = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const hostquery = { email: decodedEmail };

            const userData = await userCollection.findOne(hostquery);

            if (userData?.role !== "host") {
                return res.send({ message: "You are not  seller" });
            }
            next();
        };

        //-------------------set user in mongodb--------------------

        app.put("/setuser", async (req, res) => {
            const user = req.body;
            const query = { email: req.query.email };
            // --------------- set jwt token -------------------
            const token = jwt.sign({ email: user.email }, process.env.USER_TOKEN, { expiresIn: "1d" });

            // ---------------- verify already sign up--------------
            const isAlreadyUser = await userCollection.findOne(query);
            if (isAlreadyUser) {
                return res.send({ result: { acknowledged: false, message: "already sign up" }, token });
            }
            const updateDoc = { $set: user };
            const options = { upsert: true };
            const result = await userCollection.updateOne(query, updateDoc, options);

            res.send({ result, token });
        });

        // --------------------get product by category----------------

        app.get("/products", async (req, res) => {
            const category = req.query.category;

            let query = {};

            if (category) {
                query = { category: category };
            }

            const isAlreadyOrders = await ordersCollection.find({}).toArray();

            const productName = isAlreadyOrders.map((order) => order.productName);

            const products = await productsCollection.find(query).toArray();

            const categoryProducts = products.filter((product) => !productName.includes(product.name));

            res.send(categoryProducts);
        });

        // ---------------------booked orders products-----------------------

        app.put("/orders", verifyJwt, async (req, res) => {
            const buyerEmail = req.decoded.email;
            const id = req.query.id;
            const bookedData = req.body;
            const queryInUser = { email: buyerEmail };

            const isUser = await userCollection.findOne(queryInUser);
            if (!isUser) {
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

        // ---------------------get booking products by user email-------------------

        app.get("/userOrders", verifyJwt, async (req, res) => {
            const email = req.decoded.email;
            const query = {
                buyerEmail: email,
            };

            const ordersProducts = await ordersCollection.find(query).toArray();

            res.send(ordersProducts);
        });

        // ----------------- delete orders by user-------------------------
        app.delete("/orders", verifyJwt, async (req, res) => {
            const email = req.decoded.email;
            const id = req.query.id;
            const query = { _id: ObjectId(id) };
            const result = await ordersCollection.deleteOne(query);

            res.send(result);
        });
        ///----------------- get product for payment-----------------
        app.get("/products/:id", verifyJwt, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const product = await ordersCollection.findOne(query);
            res.send(product);
        });

        //----------------- stripe payment method and get client secret---------------
        app.post("/create-payment-intent", verifyJwt, async (req, res) => {
            const { productPrice } = req.body;

            const paymentIntent = await stripe.paymentIntents.create({
                amount: productPrice * 100,
                currency: "usd",
                payment_method_types: ["card"],
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

        //------------------add paid products in payments collection------------------
        app.post("/payments", verifyJwt, async (req, res) => {
            const data = req.body;
            const options = { upsert: true };
            // cehck in product
            const productQuery = { _id: ObjectId(data.productId) };
            const productResult = await productsCollection.findOne(productQuery);
            if (!productResult) {
                return res.send({ acknowledged: false, message: "you cant buy it" });
            }
            //check in orders
            const orderQuery = { _id: ObjectId(data.ordersId) };
            const setPayement = { $set: { payment: "paid" } };
            const ordersResult = await ordersCollection.updateOne(orderQuery, setPayement, options);
            const query = { ordersId: data.ordersId, productId: data.productId };
            const updateDoc = { $set: data };

            const result = await paymentsCollection.updateOne(query, updateDoc, options);

            res.send(result);
        });

        //------------------- is host-------------
        app.get("/hostuser", verifyJwt, verifyHost, async (req, res) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            res.send(user);
        });

        // ------------------host get products ---------------
        app.get("/myproducts", verifyJwt, verifyHost, async (req, res) => {
            const email = req.decoded.email;
            console.log(email);
            const query = { seller_email: email };
            const result = await productsCollection.find(query).toArray();
            res.send(result);
        });
        //--------------- save new products by host-----------
        app.post("/products", verifyJwt, async (req, res) => {
            const email = req.decoded.email;
            const data = req.body;
            const queryByEmail = { email: email, role: "host" };
            const isHost = await userCollection.findOne(queryByEmail);
            data["verified"] = isHost?.verified || false;
            if (!isHost) {
                return res.send({ acknowledged: false, message: "you are not a host" });
            }

            const result = await productsCollection.insertOne(data);

            res.send(result);
        });

        //-------------  host delete products ------------------
        app.delete("/myproducts", verifyJwt, verifyHost, async (req, res) => {
            const id = req.query.id;
            const query = { _id: ObjectId(id) };
            const result = await productsCollection.deleteOne(query);
            res.send(result);
        });

        //--------------------- is Admin---------------------
        app.get("/adminuser", verifyJwt, verifyAdmin, async (req, res) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            res.send(user);
        });

        // --------------get all users---------------
        app.get("/allbuyers", verifyJwt, verifyAdmin, async (req, res) => {
            const query = { role: "user" };
            const result = await userCollection.find(query).toArray();
            res.send(result);
        });

        // ------------get All hoster---------------------
        app.get("/allsellers", verifyJwt, verifyAdmin, async (req, res) => {
            const query = { role: "host" };
            const result = await userCollection.find(query).toArray();
            res.send(result);
        });

        // ------------- make host by admin ----------------
        app.put("/makehost", verifyJwt, verifyAdmin, async (req, res) => {
            const id = req.query.id;
            const userData = req.body;

            const query = { _id: ObjectId(id) };
            const updateDoc = { $set: userData };
            // const options = { upsert: true };
            const result = await userCollection.updateOne(query, updateDoc);
            console.log(result);
            res.send(result);
        });

        // --------------delete user by admib----------------
        app.delete("/deleteuser", verifyJwt, verifyAdmin, async (req, res) => {
            const id = req.query.id;
            console.log(id);
            const query = { _id: ObjectId(id) };
            const result = await userCollection.deleteOne(query);
            console.log(id, result);
            res.send(result);
        });

        //-------------------veried host by admin--------------------
        app.put("/verifiedhost", verifyJwt, verifyAdmin, async (req, res) => {
            const email = req.query.email;
            const data = req.body;
            const query = { seller_email: email };
            const updateDoc = { $set: data };
            const result = await productsCollection.updateOne(query, updateDoc);
            const userQuery = { email: email };
            const userresult = await userCollection.updateOne(userQuery, updateDoc);

            res.send({ result, userresult });
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
