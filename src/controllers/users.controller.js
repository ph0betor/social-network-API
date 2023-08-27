import User from "../models/user.model.js";
import { deleteImage, uploadImage } from "../utils/cloudinary.js";
import bcryptjs from "bcryptjs";
import { redisClient } from "../utils/redis.js";

export const getUsers = async (req, res) => {
  try {
    const reply = await redisClient.get("users");
    if (reply) return res.json(JSON.parse(reply));

    const users = await User.find().populate("role", "title");
    await redisClient.set("users", JSON.stringify(users));
    await redisClient.expire("users", 15);
    if (!users.length === 0)
      return res
        .status(200)
        .json({ message: "there are not users registered yet" });
    res.json(users);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const getUserByUsername = async (req, res) => {
  try {
    const reply = await redisClient.get(req.query.username);
    if (reply) return res.json(JSON.parse(reply));
    const userFound = await User.find({
      username: { $regex: req.query.username, $options: "i" },
    });
    await redisClient.set(req.query.username, JSON.stringify(userFound));
    await redisClient.expire(req.query.username, 15);
    res.json(userFound);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const getUser = async (req, res) => {
  try {
    const reply = await redisClient.get(req.params.id);
    if (reply) return res.json(JSON.parse(reply));

    const user = await User.findById(req.params.id).populate("role", "title");
    await redisClient.set(req.params.id, JSON.stringify(user));
    await redisClient.expire(req.params.id, 15);
    if (!user) return res.status(404).json({ message: "user not found" });
    res.json(user);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
//no email validation since is being creating by an admin.
export const createUser = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    const emailFound = await User.findOne({ email });
    if (emailFound)
      return res.status(400).json({ message: "Email already in use" });

    const usernameFound = await User.findOne({ username });
    if (usernameFound)
      return res.status(400).json({ message: "Username already in use" });

    const roleFound = await User.findOne({ title: role });
    if (!roleFound) return res.status(400).json({ message: "role not found" });

    const passHash = await bcryptjs.hash(password, 10);

    const newUser = new User({
      username,
      email,
      password: passHash,
      verified: true,
      role: roleFound._id,
    });

    const userCreated = await newUser.save();
    await userCreated.populate("role");
    res.json(userCreated);
  } catch {
    return res.status(500).json({ message: error.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { password, role, username, email } = req.body;
    const verified = req.body.verified;

    const userFound = await User.findById(req.params.id);
    if (!userFound) return res.status(404).json({ message: "user not found" });

    if (verified) userFound.verified = verified;

    if (username) {
      const usernameFound = await User.findOne({ username });
      if (usernameFound)
        return res.status(400).json({ message: "Username already in use" });
    }
    if (email) {
      const emailFound = await User.findOne({ email });
      if (emailFound)
        return res.status(400).json({ message: "Email already in use" });
    }
    if (password) {
      const passHash = await bcryptjs.hash(password, 10);
      userFound.password = passHash;
    }
    if (role) {
      const roleFound = await User.findOne({ title: role });
      userFound.role = roleFound._id;
    }
    const updatedUser = await userFound.save();
    if (req.files?.image) {
      if (userFound.image?.public_id) {
        await deleteImage(userFound.image.public_id);
      }
      const result = await uploadImage(req.files.image.tempFilePath);
      userFound.image = {
        public_id: result.public_id,
        secure_url: result.secure_url,
      };
      await fs.unlinkSync(req.files.image.tempFilePath);
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const userFound = await User.findById(req.params.id);
    if (!userFound) return res.status(404).json({ message: "user not found" });
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "user deleted" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
