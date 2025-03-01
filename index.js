const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "DELETE"],
  },
});

app.use(express.json());
app.use(cors());

const MONGODB_URI="mongodb+srv://yashveer8000:LXEWfLvG4erBt8VR@cluster1.j5ezk.mongodb.net/melodychat?retryWrites=true&w=majority&appName=Cluster1";

// Connect to MongoDB
mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Error connecting to MongoDB:", err));

// Define schemas
const messageSchema = new mongoose.Schema({
  user: String,
  text: String,
  timestamp: String,
});

const roomSchema = new mongoose.Schema({
  roomId: String,
  creatername: String,
  members: [String],
  messages: [messageSchema],
});

const Room = mongoose.model("Room", roomSchema);

app.get("/fetch-yt", async (req, res) => {
  try {
    const response = await axios.get("https://www.youtube.com/pagead/viewthroughconversion/962985656/", {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    res.send(response.data);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Create a new room
app.post("/api/create-room", async (req, res) => {
  const { roomId, creatername } = req.body;

  const existingRoom = await Room.findOne({ roomId });
  if (existingRoom) {
    return res.status(400).json({ message: "Room ID already exists." });
  }

  const newRoom = new Room({ roomId, creatername, members: [], messages: [] });
  await newRoom.save();
  res.status(201).json({ message: "Room created successfully!" });
});

// Join an existing room
app.post("/api/join-room/:roomId", async (req, res) => {
  const { roomId } = req.params;
  const { membername } = req.body;

  const room = await Room.findOne({ roomId });
  if (!room) {
    return res.status(404).json({ message: "Room not found." });
  }

  room.members.push(membername);
  await room.save();

  res.status(200).json({ message: `Member ${membername} joined successfully` });
});

// Send a message
app.post("/api/send-message", async (req, res) => {
  const { roomId, user, text } = req.body;
  const timestamp = new Date().toLocaleString();

  const room = await Room.findOne({ roomId });
  if (!room) {
    return res.status(404).json({ message: "Room not found." });
  }

  const message = { user, text, timestamp };
  room.messages.push(message);
  await room.save();

  io.to(roomId).emit("receiveMessage", message);

  res.status(200).json({ message: "Message sent successfully!" });
});

// Get messages from a room
app.get("/api/room-messages/:roomId", async (req, res) => {
  const { roomId } = req.params;

  const room = await Room.findOne({ roomId });
  if (!room) {
    return res.status(404).json({ message: "Room not found." });
  }

  res.status(200).json({ messages: room.messages });
});

// Close Room API
app.delete("/api/close-room/:roomId", async (req, res) => {
  const { roomId } = req.params;

  const room = await Room.findOne({ roomId });

  if (!room) {
    return res.status(404).json({ message: "Room not found" });
  }

  // Notify all members that the room has been closed
  io.to(roomId).emit("roomClosed", { message: "Room has been closed by host" });

  // Delete the room from the database
  await Room.deleteOne({ roomId });

  res.json({ message: "Room closed successfully" });
});


// Socket.io connection
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("joinRoom", ({ roomId, user }) => {
    socket.join(roomId);
    console.log(`${user} joined room ${roomId}`);
  });

  socket.on("sendMessage", (message) => {
    io.to(message.roomId).emit("receiveMessage", message);
  });

  socket.on("sendMusic", (data) => {
    io.to(data.roomId).emit("receiveMusic", data);
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});

// Start the server
const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
