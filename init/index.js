const mongoose = require('mongoose');
const initData = require('./data');
const Listing = require('../models/listing');

const MONGO_URL = "mongodb://127.0.0.1:27017/wanderlust"

main()
.then(() =>{
    console.log("connected to DB");
})
.catch(err => console.log(err));

async function main() {
    await mongoose.connect(MONGO_URL);
}


const initDB = async() =>{
    await Listing.deleteMany({});
    initData.data = initData.data.map((obj) =>({...obj, owner : "6a3f808b8b3d670024f0ff7c"}));
    await Listing.insertMany(initData.data);
    console.log("Data was initialized");
};

initDB();
