import db from "../config/db.js";

export const getAllHobbies = async (req, res) => {
  try {
    const query = `SELECT * FROM hobbies_tbl`;
    const [hobbyData] = await db.query(query);

    res.status(200).json({
      status: true,
      hobbies: hobbyData,
    });
  } catch (err) {
    console.error("Unable to fetch Hobbies: ", err);
    res.status(500).json({
      error: "Failed to fetch Hobbies",
    });
  }
};
