const express = require("express");
const mongoose = require("mongoose");
const Task = require("../models/Task");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

// Get tasks with optional search and filters
router.get("/", async (req, res) => {
  try {
    const { search = "", status, priority, subject } = req.query;

    const filter = { user: req.userId };

    if (status && ["Pending", "In Progress", "Completed"].includes(status)) {
      filter.status = status;
    }

    if (priority && ["Low", "Medium", "High"].includes(priority)) {
      filter.priority = priority;
    }

    if (subject) {
      filter.subject = subject;
    }

    if (search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");

      filter.$or = [
        { title: regex },
        { subject: regex },
        { description: regex }
      ];
    }

    const tasks = await Task.find(filter).sort({
      dueDate: 1,
      createdAt: -1
    });

    return res.json(tasks);
  } catch (error) {
    console.error("Fetch tasks error:", error.message);
    return res.status(500).json({
      message: "Unable to fetch tasks."
    });
  }
});

// Create a task
router.post("/", async (req, res) => {
  try {
    const { title, subject, description, dueDate, priority, status } = req.body;

    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof subject !== "string" ||
      !subject.trim() ||
      !dueDate ||
      Number.isNaN(Date.parse(dueDate))
    ) {
      return res.status(400).json({
        message: "Title, subject and a valid due date are required."
      });
    }

    const task = await Task.create({
      title: title.trim(),
      subject: subject.trim(),
      description: typeof description === "string" ? description.trim() : "",
      dueDate: new Date(dueDate),
      priority: priority || "Medium",
      status: status || "Pending",
      user: req.userId
    });

    return res.status(201).json(task);
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Please check your task details and try again."
      });
    }

    console.error("Create task error:", error.message);
    return res.status(500).json({
      message: "Unable to create task."
    });
  }
});

// Update a task
router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid task ID." });
    }

    const allowedFields = [
      "title",
      "subject",
      "description",
      "dueDate",
      "priority",
      "status"
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    }

    if (updates.title !== undefined && !String(updates.title).trim()) {
      return res.status(400).json({ message: "Title cannot be empty." });
    }

    if (updates.subject !== undefined && !String(updates.subject).trim()) {
      return res.status(400).json({ message: "Subject cannot be empty." });
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!task) {
      return res.status(404).json({
        message: "Task not found."
      });
    }

    return res.json(task);
  } catch (error) {
    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({ message: "Invalid task details." });
    }

    console.error("Update task error:", error.message);
    return res.status(500).json({ message: "Unable to update task." });
  }
});

// Delete a task
router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid task ID." });
    }

    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      user: req.userId
    });

    if (!task) {
      return res.status(404).json({
        message: "Task not found."
      });
    }

    return res.json({ message: "Task deleted successfully." });
  } catch (error) {
    console.error("Delete task error:", error.message);
    return res.status(500).json({ message: "Unable to delete task." });
  }
});

module.exports = router;