import mongoose from "mongoose";

// Connect to MongoDB
const connectDB = async () => {
  try {
    console.log("Mongo URI exists:", !!process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected...");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error.message);
    process.exit(1);
  }
};

export default connectDB;
