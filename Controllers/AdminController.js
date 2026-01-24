import bcrypt from "bcryptjs";
import db from "../config/db.js";
import jwt from "jsonwebtoken"; // Import JWT
import nodemailer from "nodemailer";

export const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    const ADMIN_USERNAME = "admin";
    const ADMIN_PASSWORD = "admin@ideagroove";

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required.",
      });
    }

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      return res
        .status(200)
        .cookie("admin_token", "authorized_access_granted", {
          httpOnly: true,
          sameSite: "strict",
          maxAge: 24 * 60 * 60 * 1000, // 1 day
        })
        .json({
          success: true,
          message: "Login Successful!",
          role: "admin",
        });
    } else {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials. Access denied.",
      });
    }
  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};
