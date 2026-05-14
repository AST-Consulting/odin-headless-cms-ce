const { google } = require('googleapis');
const auth = new google.auth.GoogleAuth({
  keyFile: 'ga_credentials.json', // I hope it exists
  scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
});
// this requires loading the provider... maybe too hard to mock.
