const taskService = require('../services/taskService');
const { sendOk } = require('../utils/responseUtils');

async function listUsers({ res }) {
  sendOk(res, 'Users loaded', await taskService.listAssignableUsers());
}

async function listTasks({ res }) {
  sendOk(res, 'Tasks loaded', await taskService.listTasks());
}

async function createTask({ res, body, user }) {
  const task = await taskService.createTask(body.content, user);
  sendOk(res, 'Task created successfully', task, 201);
}

async function updateTask({ res, params, body }) {
  const task = await taskService.updateTask(params.id, body);
  sendOk(res, 'Task updated successfully', task);
}

async function deleteTask({ res, params }) {
  await taskService.deleteTask(params.id);
  sendOk(res, 'Task deleted successfully');
}

module.exports = { listUsers, listTasks, createTask, updateTask, deleteTask };
