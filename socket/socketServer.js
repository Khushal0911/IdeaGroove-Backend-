import { Server } from "socket.io";
import { encryptMessage, decryptMessage } from "../utils/chatEncryption.js";

export const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  const onlineUsers = new Map();

  io.on("connection", (socket) => {
    console.log(`[Socket] connected: ${socket.id}`);

    socket.on("user:online", ({ studentId }) => {
      if (!studentId) return;
      onlineUsers.set(String(studentId), socket.id);
      socket.data.studentId = String(studentId);
      io.emit("user:status", { studentId, status: "online" });
      const currentOnline = Array.from(onlineUsers.keys());
      socket.emit("users:online_list", { onlineUserIds: currentOnline });
    });

    socket.on("room:subscribe", ({ roomId }) => {
      if (!roomId) return;
      socket.join(String(roomId));
    });

    socket.on("room:join", async ({ roomId, studentId }) => {
      if (!roomId) return;
      socket.join(String(roomId));

      try {
        const { default: db } = await import("../config/db.js");

        let memberId = null;
        if (studentId) {
          const [memberData] = await db.query(
            `SELECT Member_ID FROM chat_room_members_tbl
             WHERE Room_ID = ? AND Student_ID = ? AND Is_Active = 1`,
            [roomId, studentId],
          );
          if (memberData.length > 0) {
            memberId = memberData[0].Member_ID;
          }
        }

        // ✅ FIX: Removed `AND c.Is_Deleted = 0` so deleted messages are
        // included in history. Both sender and receiver see the
        // "Message deleted" placeholder rendered by ChatBody.
        const [messages] = await db.query(
          `SELECT *
           FROM (
             SELECT
               c.Message_ID, c.Room_ID, c.Sender_ID,
               s.username AS Sender_Username,
               s.name AS Sender_Name,
               s.Profile_Pic AS Sender_Profile_Pic,
               c.Message_Type,
               c.Message_Text,
               c.File_Path,
               c.Encryption_IV,
               c.Sent_On, c.Is_Edited, c.Is_Deleted,
               EXISTS(
                 SELECT 1 FROM chats_seen_tbl cs
                 WHERE cs.Message_ID = c.Message_ID AND cs.Member_ID = ?
                 LIMIT 1
               ) AS Is_Seen
             FROM chats_tbl c
             JOIN student_tbl s ON c.Sender_ID = s.S_ID
             WHERE c.Room_ID = ?
             ORDER BY c.Sent_On DESC
             LIMIT 50
           ) recent_messages
           ORDER BY recent_messages.Sent_On ASC`,
          [memberId, roomId],
        );

        const decryptedMessages = messages.map((msg) => {
          // ✅ FIX: Skip decryption entirely for deleted messages —
          // their content is irrelevant and the IV may have been cleared.
          if (msg.Is_Deleted) return msg;

          if (!msg.Encryption_IV) return msg;
          try {
            if (msg.Message_Type === "text" && msg.Message_Text) {
              return {
                ...msg,
                Message_Text: decryptMessage(
                  msg.Message_Text,
                  msg.Encryption_IV,
                ),
              };
            } else if (
              (msg.Message_Type === "image" || msg.Message_Type === "file") &&
              msg.File_Path
            ) {
              return {
                ...msg,
                // Message_Text holds filename (unencrypted) — leave it as-is
                File_Path: decryptMessage(msg.File_Path, msg.Encryption_IV),
              };
            }
          } catch (err) {
            console.error("[Socket] room:join decryption error:", err);
          }
          return msg;
        });

        socket.emit("room:history", { roomId, messages: decryptedMessages });

        if (memberId) {
          const [unread] = await db.query(
            `SELECT c.Message_ID FROM chats_tbl c
             LEFT JOIN chats_seen_tbl cs
               ON c.Message_ID = cs.Message_ID AND cs.Member_ID = ?
             WHERE c.Room_ID = ?
               AND c.Sender_ID != ?
               AND c.Is_Deleted = 0
               AND cs.Seen_ID IS NULL`,
            [memberId, roomId, studentId],
          );

          for (const row of unread) {
            await db.query(
              `INSERT IGNORE INTO chats_seen_tbl (Message_ID, Member_ID) VALUES (?, ?)`,
              [row.Message_ID, memberId],
            );
          }

          socket.to(String(roomId)).emit("message:seen_update", {
            roomId,
            seenBy: studentId,
          });
        }
      } catch (err) {
        console.error("[Socket] room:join error:", err);
      }
    });

    socket.on("room:leave", ({ roomId }) => {
      if (roomId) socket.leave(String(roomId));
    });

    socket.on("message:send", async ({ roomId, message }) => {
      const studentId = socket.data.studentId;
      if (!roomId || !message?.trim() || !studentId) return;

      try {
        const { default: db } = await import("../config/db.js");

        const [membership] = await db.query(
          `SELECT Member_ID FROM chat_room_members_tbl
           WHERE Room_ID = ? AND Student_ID = ? AND Is_Active = 1`,
          [roomId, studentId],
        );
        if (membership.length === 0) {
          socket.emit("error", {
            message: "You are not a member of this room",
          });
          return;
        }

        const { encryptedData, iv } = encryptMessage(message.trim());

        const [result] = await db.query(
          `INSERT INTO chats_tbl (Room_ID, Sender_ID, Message_Type, Message_Text, Encryption_IV)
           VALUES (?, ?, 'text', ?, ?)`,
          [roomId, studentId, encryptedData, iv],
        );

        const [rows] = await db.query(
          `SELECT
             c.Message_ID, c.Room_ID, c.Sender_ID,
             s.username AS Sender_Username,
             s.name AS Sender_Name,
             s.Profile_Pic AS Sender_Profile_Pic,
             c.Message_Type, c.Message_Text, c.File_Path,
             c.Encryption_IV, c.Sent_On, c.Is_Edited, c.Is_Deleted
           FROM chats_tbl c
           JOIN student_tbl s ON c.Sender_ID = s.S_ID
           WHERE c.Message_ID = ?`,
          [result.insertId],
        );

        const newMessage = rows[0];
        if (newMessage.Message_Text && newMessage.Encryption_IV) {
          try {
            newMessage.Message_Text = decryptMessage(
              newMessage.Message_Text,
              newMessage.Encryption_IV,
            );
          } catch (err) {
            console.error("[Socket] message:send decryption error:", err);
          }
        }

        io.to(String(roomId)).emit("message:new", {
          roomId: Number(roomId),
          message: newMessage,
        });
      } catch (err) {
        console.error("[Socket] message:send error:", err);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    socket.on("message:load_more", async ({ roomId, offset = 0 }) => {
      try {
        const { default: db } = await import("../config/db.js");

        // ✅ FIX: Also include deleted messages in load_more so history is consistent
        const [messages] = await db.query(
          `SELECT
             c.Message_ID, c.Room_ID, c.Sender_ID,
             s.username AS Sender_Username,
             s.name AS Sender_Name,
             s.Profile_Pic AS Sender_Profile_Pic,
             c.Message_Type, c.Message_Text, c.File_Path,
             c.Encryption_IV, c.Sent_On, c.Is_Edited, c.Is_Deleted
           FROM chats_tbl c
           JOIN student_tbl s ON c.Sender_ID = s.S_ID
           WHERE c.Room_ID = ?
           ORDER BY c.Sent_On ASC
           LIMIT 50 OFFSET ?`,
          [roomId, offset],
        );

        const decryptedMessages = messages.map((msg) => {
          if (msg.Is_Deleted) return msg;
          if (!msg.Encryption_IV) return msg;
          try {
            if (msg.Message_Type === "text" && msg.Message_Text) {
              return {
                ...msg,
                Message_Text: decryptMessage(
                  msg.Message_Text,
                  msg.Encryption_IV,
                ),
              };
            } else if (
              (msg.Message_Type === "image" || msg.Message_Type === "file") &&
              msg.File_Path
            ) {
              return {
                ...msg,
                File_Path: decryptMessage(msg.File_Path, msg.Encryption_IV),
              };
            }
          } catch (err) {
            console.error("[Socket] message:load_more decryption error:", err);
          }
          return msg;
        });

        socket.emit("message:more", { roomId, messages: decryptedMessages });
      } catch (err) {
        console.error("[Socket] message:load_more error:", err);
      }
    });

    socket.on("message:seen", async ({ roomId }) => {
      const studentId = socket.data.studentId;
      if (!roomId || !studentId) return;

      try {
        const { default: db } = await import("../config/db.js");

        const [memberData] = await db.query(
          `SELECT Member_ID FROM chat_room_members_tbl
           WHERE Room_ID = ? AND Student_ID = ? AND Is_Active = 1`,
          [roomId, studentId],
        );
        if (memberData.length === 0) return;

        const memberId = memberData[0].Member_ID;

        const [unread] = await db.query(
          `SELECT c.Message_ID FROM chats_tbl c
           LEFT JOIN chats_seen_tbl cs
             ON c.Message_ID = cs.Message_ID AND cs.Member_ID = ?
           WHERE c.Room_ID = ?
             AND c.Sender_ID != ?
             AND c.Is_Deleted = 0
             AND cs.Seen_ID IS NULL`,
          [memberId, roomId, studentId],
        );

        for (const row of unread) {
          await db.query(
            `INSERT IGNORE INTO chats_seen_tbl (Message_ID, Member_ID) VALUES (?, ?)`,
            [row.Message_ID, memberId],
          );
        }

        socket.to(String(roomId)).emit("message:seen_update", {
          roomId,
          seenBy: studentId,
        });
      } catch (err) {
        console.error("[Socket] message:seen error:", err);
      }
    });

    /* ──────────────────────────────────────────────
       SEND FILE/IMAGE
    ────────────────────────────────────────────── */
    socket.on(
      "message:send_file",
      async ({ roomId, fileUrl, messageType, fileName }) => {
        const studentId = socket.data.studentId;
        if (!roomId || !fileUrl || !studentId) return;

        try {
          const { default: db } = await import("../config/db.js");

          const [membership] = await db.query(
            `SELECT Member_ID FROM chat_room_members_tbl
           WHERE Room_ID = ? AND Student_ID = ? AND Is_Active = 1`,
            [roomId, studentId],
          );
          if (membership.length === 0) return;

          const { encryptedData, iv } = encryptMessage(fileUrl);

          const [result] = await db.query(
            `INSERT INTO chats_tbl
            (Room_ID, Sender_ID, Message_Type, Message_Text, File_Path, Encryption_IV)
           VALUES (?, ?, ?, ?, ?, ?)`,
            [
              roomId,
              studentId,
              messageType,
              fileName || null,
              encryptedData,
              iv,
            ],
          );

          const [rows] = await db.query(
            `SELECT
             c.Message_ID, c.Room_ID, c.Sender_ID,
             s.username AS Sender_Username,
             s.name AS Sender_Name,
             s.Profile_Pic AS Sender_Profile_Pic,
             c.Message_Type, c.Message_Text, c.File_Path,
             c.Encryption_IV, c.Sent_On, c.Is_Edited, c.Is_Deleted
           FROM chats_tbl c
           JOIN student_tbl s ON c.Sender_ID = s.S_ID
           WHERE c.Message_ID = ?`,
            [result.insertId],
          );

          const newMessage = rows[0];

          if (newMessage.File_Path && newMessage.Encryption_IV) {
            try {
              newMessage.File_Path = decryptMessage(
                newMessage.File_Path,
                newMessage.Encryption_IV,
              );
            } catch (err) {
              console.error("[Socket] send_file decryption error:", err);
            }
          }

          io.to(String(roomId)).emit("message:new", {
            roomId: Number(roomId),
            message: newMessage,
          });
        } catch (err) {
          console.error("[Socket] message:send_file error:", err);
        }
      },
    );

    socket.on("message:edit", async ({ roomId, messageId, newText }) => {
      const studentId = socket.data.studentId;
      if (!roomId || !messageId || !newText?.trim() || !studentId) return;

      try {
        const { default: db } = await import("../config/db.js");
        const { encryptedData, iv } = encryptMessage(newText.trim());

        const [result] = await db.query(
          `UPDATE chats_tbl SET Message_Text = ?, Encryption_IV = ?, Is_Edited = 1
           WHERE Message_ID = ?
             AND Sender_ID = ?
             AND Is_Deleted = 0
             AND Sent_On >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)`,
          [encryptedData, iv, messageId, studentId],
        );

        if (result.affectedRows > 0) {
          // ✅ This already broadcasts to ALL room members including receiver —
          // the client useChat.js listens for message:edited and calls
          // updateMessage({ messageId, changes: { Message_Text: newText, Is_Edited: 1 } })
          // which updates Redux for both sender and receiver in real time.
          io.to(String(roomId)).emit("message:edited", {
            roomId: Number(roomId),
            messageId,
            newText: newText.trim(),
          });
        } else {
          socket.emit("error", {
            message: "Messages can only be edited within 5 minutes",
          });
        }
      } catch (err) {
        console.error("[Socket] message:edit error:", err);
      }
    });

    socket.on("message:delete", async ({ roomId, messageId }) => {
      const studentId = socket.data.studentId;
      if (!roomId || !messageId || !studentId) return;

      try {
        const { default: db } = await import("../config/db.js");

        const [result] = await db.query(
          `UPDATE chats_tbl SET Is_Deleted = 1
           WHERE Message_ID = ? AND Sender_ID = ?`,
          [messageId, studentId],
        );

        if (result.affectedRows > 0) {
          io.to(String(roomId)).emit("message:deleted", {
            roomId: Number(roomId),
            messageId,
          });
        }
      } catch (err) {
        console.error("[Socket] message:delete error:", err);
      }
    });

    socket.on("typing:start", ({ roomId }) => {
      const studentId = socket.data.studentId;
      if (!roomId || !studentId) return;
      socket
        .to(String(roomId))
        .emit("typing:update", { roomId, studentId, isTyping: true });
    });

    socket.on("typing:stop", ({ roomId }) => {
      const studentId = socket.data.studentId;
      if (!roomId || !studentId) return;
      socket
        .to(String(roomId))
        .emit("typing:update", { roomId, studentId, isTyping: false });
    });

    socket.on("rooms:unread_counts", async ({ roomIds }) => {
      const studentId = socket.data.studentId;
      if (!studentId || !roomIds?.length) return;

      try {
        const { default: db } = await import("../config/db.js");

        const [memberData] = await db.query(
          `SELECT Room_ID, Member_ID FROM chat_room_members_tbl
           WHERE Student_ID = ? AND Is_Active = 1`,
          [studentId],
        );

        const memberMap = {};
        memberData.forEach((m) => {
          memberMap[m.Room_ID] = m.Member_ID;
        });

        const counts = {};
        for (const roomId of roomIds) {
          const memberId = memberMap[roomId];
          if (!memberId) {
            counts[roomId] = 0;
            continue;
          }
          const [rows] = await db.query(
            `SELECT COUNT(*) AS cnt
             FROM chats_tbl c
             LEFT JOIN chats_seen_tbl cs
               ON c.Message_ID = cs.Message_ID AND cs.Member_ID = ?
             WHERE c.Room_ID = ?
               AND c.Sender_ID != ?
               AND c.Is_Deleted = 0
               AND cs.Seen_ID IS NULL`,
            [memberId, roomId, studentId],
          );
          counts[roomId] = rows[0].cnt;
        }

        socket.emit("rooms:unread_counts", counts);
      } catch (err) {
        console.error("[Socket] rooms:unread_counts error:", err);
      }
    });

    socket.on("disconnect", () => {
      const studentId = socket.data.studentId;
      if (studentId) {
        onlineUsers.delete(studentId);
        io.emit("user:status", { studentId, status: "offline" });
      }
      console.log(`[Socket] disconnected: ${socket.id}`);
    });
  });

  return io;
};
