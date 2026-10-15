const taskController = require('../controllers/taskController');

module.exports = [
  { method: 'GET', path: '/api/users', protect: true, handler: taskController.listUsers },
  { method: 'GET', path: '/api/tasks', protect: true, handler: taskController.listTasks },
  { method: 'POST', path: '/api/tasks', protect: true, handler: taskController.createTask },
  { method: 'PATCH', path: '/api/tasks/:id', protect: true, handler: taskController.updateTask },
  { method: 'DELETE', path: '/api/tasks/:id', protect: true, handler: taskController.deleteTask },
];
