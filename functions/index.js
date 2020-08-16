const functions = require('firebase-functions');
const admin = require('firebase-admin');

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

admin.initializeApp();

const db = admin.firestore();

exports.incrementBookView = functions.https.onRequest(async (request, response) => {

    bookID = request.query.bookID;
    userID = request.query.userID;
    
    const bookRef = db.collection("books").doc(bookID);
    bookRef.get().then(function(bookObject){
        var viewedBy = [];
        if (bookObject.get("viewedBy") !== null){
            viewedBy = bookObject.get("viewedBy");
            viewedBy.push(userID);
            
            console.log("Adding user");
        }
        else{
            console.log("Creating and adding user");
            viewedBy = [userID];
            bookObject.set("viewedBy", viewedBy);
        }
        console.log("Saving book");
        return bookObject.ref.update({viewedBy: viewedBy});
    }).then(function(saved){
        console.log("Saved successfully");
        response.send(saved);
    }, function(error){
        alert("Error" + error.code + " " + error.message);
        response.error(error);
    });


});

exports.sendPushForBook = functions.https.onRequest(async (request, response) => {

  var fromUser = request.query.fromUser;
  var toUser = request.query.toUser;
  var bookTitle = request.query.bookTitle;
  var nodeID = request.query.nodeID;
  var name;

  const fromUserRef = db.collection("users").doc(fromUser);
  fromUserRef.get().then(function(fromUserSnapshot){
      
      name = fromUserSnapshot.get("first_name");

      var toUserRef = db.collection("users").doc(toUser);

      var toUserInstall = db.collection("installations");
      toUserInstall.where("user","==",toUserRef)

      return toUserInstall.get();
  }).then(function(toUserInstallSnapshot){

    const regToken = toUserInstallSnapshot.get("deviceToken");

    var message = {
        data: {
            "alert": "New message from " + name + " for " + bookTitle,
            "sound": "default",
            "content-available": 1,
            "background_data": true,
            "nodeID" : nodeID,
            "book" : bookTitle,
            "name" : name,
            "type" : "TXT-MSG"
        },
        token: regToken
      };

    return admin.messaging().send(message);
  }).then(function(pushResult){
    console.log("Push successfully sent for book");
    response.success(true);
  }, function(error){
    console.log("Error" + error.code + " " + error.message);
    alert("Error" + error.code + " " + error.message);
    response.error(error);
  });
});