require('dotenv').config();
const createApp = require('./src/app');

const port = process.env.PORT || 3001;
const app = createApp();

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});