const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/philogpt_test')
.then(() => {
  console.log('Connected to test MongoDB');
  mongoose.connection.close();
  console.log('Test completed successfully');
})
.catch(err => {
  console.error('Test failed:', err);
  mongoose.connection.close();
});