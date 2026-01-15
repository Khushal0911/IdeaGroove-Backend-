import passport from "passport";
import db from "./db.js"; // Ensure this path is correct relative to passport.js

passport.serializeUser((user, done) => {
  console.log("--- SERIALIZING USER ---");
  // console.log(user); // Uncomment to see full object if it fails

  // Robust ID check
  const userId = user.S_ID || user.Student_ID || user.id || user.student_id;

  if (!userId) {
    console.error("❌ SERIALIZE ERROR: User object has no ID!", user);
    return done(new Error("User object missing ID field"), null);
  }

  console.log("✅ Serializing ID:", userId);
  done(null, userId);
});

passport.deserializeUser(async (id, done) => {
  try {
    // console.log("--- DESERIALIZING ID:", id);
    const [rows] = await db.query("SELECT * FROM student_tbl WHERE S_ID = ?", [
      id,
    ]);

    if (rows.length > 0) {
      const user = rows[0];
      delete user.Password;
      done(null, user);
    } else {
      done(null, null);
    }
  } catch (err) {
    console.error("❌ DESERIALIZE ERROR:", err);
    done(err, null);
  }
});
