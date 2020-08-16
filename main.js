// Use Parse.Cloud.define to define as many cloud functions as you want.
// For example:

var client = require('./node_modules/myMailModule-1.0.0.js');
client.initialize("no-reply.101textbooks.com", "key-170746753e4e0471ce067dd6dd5d9a67");

Parse.Cloud.define("sendPushForBook", function(request, response){
    //Parse.Cloud.useMasterKey();

    var fromUser = request.params.fromUser;
    var toUser = request.params.toUser;
    var bookTitle = request.params.bookTitle;
    var nodeID = request.params.nodeID;
    var name;

    var nameQuery = new Parse.Query(Parse.User);
    nameQuery.get(fromUser, {useMasterKey:true}).then(function(uResult){
        name = uResult.get("first_name");

        var query1 = new Parse.Query(Parse.User);
        query1.equalTo("objectId", toUser);

        var query2 = new Parse.Query(Parse.Installation);
        query2.matchesQuery("user", query1);

        return Parse.Push.send({where: query2, data: {
            "alert": "New message from " + name + " for " + bookTitle,
            "sound": "default",
            "content-available": 1,
            "background_data": true,
            "nodeID" : nodeID,
            "book" : bookTitle,
            "name" : name,
            "type" : "TXT-MSG"
        }}, {useMasterKey:true});
    }).then(function(pResult){
        console.log("Push successfully sent for book");
        response.success(true);
    }, function(error){
        console.log("Error" + error.code + " " + error.message);
        alert("Error" + error.code + " " + error.message);
        response.error(error);
    });
});

Parse.Cloud.define("contactWaitList", function(request, response){
    //Parse.Cloud.useMasterKey();

    // response.success(true);
    console.log("Sending push to wait list");
    var isbn = request.params.isbn;
    var bookID = request.params.bookID;
    var bookTitle = request.params.bookTitle;
    var poster = request.params.poster;

    //var listClass = Parse.Object.extend("WaitList");
    var isbn10 = new Parse.Query("WaitList");
    isbn10.equalTo("isbn10", isbn);

    var isbn13 = new Parse.Query("WaitList");
    isbn13.equalTo("isbn13", isbn);

    var orQuery = new Parse.Query("WaitList");
    var orQuery = Parse.Query.or(isbn10, isbn13);

    var mainQuery = new Parse.Query(Parse.Installation);
    mainQuery.matchesKeyInQuery("user", "user", orQuery);
    mainQuery.notEqualTo("user", {"__type": "Pointer", "className": "_User", "objectId": poster});

    Parse.Push.send({where: mainQuery, data: {
        "alert": "One of your wait-listed books, '" + bookTitle + "' just got added to Textbooks 101",
        "sound": "default",
        "content-available": 1,
        "background_data": true,
        "bookID" : bookID,
        "title" : bookTitle,
        "type" : "TXT-WAITLIST"
    }}, {useMasterKey:true}).then(function(pResult){
        console.log("Push successfully sent for wait list");
        response.success(true);
    }, function(error){
        console.log("Error" + error.code + " " + error.message);
        response.error(error);
    });
});

Parse.Cloud.define("addToRolesMSG", function(request, response){

    var buyerID = request.params.buyerID;
    var sellerID = request.params.sellerID;


    var userObject = new Parse.Object.extend("User");
    var buyerObject = new userObject();
    buyerObject.id = buyerID;

    var sellerObject = new userObject();
    sellerObject.id = sellerID;

    var query1 = new Parse.Query('_Role');
    query1.equalTo("name", buyerID);
    query1.find({useMasterKey:true}).then(function(results){
        var buyerRole = results[0];
        buyerRole.getUsers().add(sellerObject);
        return buyerRole.save(null, {useMasterKey:true});
    }).then(function(buyerItem){
        console.log("Saved buyer role");
        console.log("Getting seller role");
        var query2 = new Parse.Query('_Role');
        query2.equalTo("name", sellerID);
        return query2.find({useMasterKey:true});
    }).then(function(sResults){
        var sellerRole = sResults[0];
        console.log(sResults.length);
        sellerRole.getUsers().add(buyerObject);
        console.log("Added buyer to seller role");
        return sellerRole.save(null, {useMasterKey:true})
    }).then(function(sResult){
        console.log("Saved seller role");
        response.success(true);
    }, function(error){
        console.log("ERROR" + error.code + " " + error.message);
        alert("Error" + error.code + " " + error.message);
        response.error(error);
    });
});

Parse.Cloud.define("sendReqMessage", function(request, response){
    //Parse.Cloud.useMasterKey();

    var buyer = request.params.buyer;
    var seller = request.params.seller;
    var messageSubject = request.params.subject;
    var messageText = request.params.message;
    var book = request.params.book;
    var bookTitle = request.params.bookTitle;

    var message = new Parse.Object("Message");
    var messageNode = new Parse.Object("MessageNode");

    var acl = new Parse.ACL();
    acl.setPublicReadAccess(false);
    acl.setPublicWriteAccess(false);
    acl.setWriteAccess(buyer, true);
    acl.setWriteAccess(seller, true);
    acl.setReadAccess(buyer, true);
    acl.setReadAccess(seller, true);
    message.setACL(acl);
    messageNode.setACL(acl);

    messageNode.set("buyer", {"__type": "Pointer", "className": "_User", "objectId": buyer});
    messageNode.set("seller", {"__type": "Pointer", "className": "_User", "objectId": seller});
    messageNode.set("forBook", {"__type": "Pointer", "className": "Book", "objectId": book});
    messageNode.set("buyerRead", true);
    messageNode.set("sellerRead", false);
    messageNode.set("subject", messageSubject);

    message.set("fromUser",  {"__type": "Pointer", "className": "_User", "objectId": buyer});
    message.set("toUser",  {"__type": "Pointer", "className": "_User", "objectId": seller});
    message.set("forBook",  {"__type": "Pointer", "className": "Book", "objectId": book});
    message.set("node", messageNode);
    message.set("text", messageText);

    var parameters = {buyerID: buyer, sellerID: seller};

    var fromUser = request.params.fromUser;
    var toUser = request.params.toUser;
    var bookTitle = request.params.bookTitle;
    var nodeID = request.params.nodeID;

    Parse.Cloud.run('addToRolesMSG', parameters).then(function(result){
        console.log("Roles configured");
        return message.save(null, {useMasterKey:true});
    }).then(function(mSuccess) {
        console.log("Message Saved");
        var messages = messageNode.relation("messages");
        messages.add(message);
        return messageNode.save(null, {useMasterKey:true});
    }).then(function(nSuccess){
        console.log("Node Saved");
        return Parse.Cloud.run("sendPushForBook", {fromUser: buyer, toUser: seller, bookTitle: bookTitle, nodeID: messageNode.id});
    }).then(function(pushResult) {
        console.log("Push Sent");
        console.log(pushResult);
        return Parse.Cloud.run("sendEmailForBook", {fromUser: buyer, toUser: seller, bookTitle: bookTitle, nodeID: messageNode.id});
    }).then(function(emailResult){
        console.log("Email Sent");
        response.success(true);
    }, function(error){
        console.log("ERROR" + error.code + " " + error.message);
        alert("Error" + error.code + " " + error.message);
        response.error(error);
    });
});

Parse.Cloud.define("deleteBook", function(request, response){
    //Parse.Cloud.useMasterKey();

    var bookID = request.params.bookID;
    var bookObject;

    var objectsToDelete = [];

    var bookQuery = new Parse.Query("Book");
    bookQuery.get(bookID, { useMasterKey: true }).then(function(book){
        bookObject = book;
        objectsToDelete.push(book);
        console.log("Book object retrieved, prepped for deletion");
        var nodeQuery = new Parse.Query("MessageNode");
        nodeQuery.equalTo("forBook", book);
        return nodeQuery.find({ useMasterKey: true });
    }).then(function(nodes){
        objectsToDelete.push.apply(objectsToDelete, nodes);
        console.log(nodes.length + " Nodes retrieved, prepped for deletion");
        var msgQuery = new Parse.Query("Message");
        msgQuery.equalTo("forBook", bookObject);
        return msgQuery.find({ useMasterKey: true });
    }).then(function(messages){
        objectsToDelete.push.apply(objectsToDelete, messages);
        console.log(messages.length + " Messages retrieved, prepped for deletion");
        return Parse.Object.destroyAll(objectsToDelete, { useMasterKey: true });
    }).then(function(result){
        console.log("Book successfully deleted");
        response.success(true);
    }, function(error){
        alert("Error" + error.code + " " + error.message);
        response.error(error);
    });


});

Parse.Cloud.define("removeFromRoles", function(request, response){
    //Parse.Cloud.useMasterKey();

    var buyerID = request.params.buyerID;
    var buyerObject = Parse.Object.createWithoutData(buyerID);
    var sellerID = request.params.sellerID;
    var sellerObject = Parse.Object.createWithoutData(sellerID);

    var userObject = new Parse.Object.extend("_User");
    var buyerObject = new userObject();
    buyerObject.id = buyerID;

    var sellerObject = new userObject();
    sellerObject.id = sellerID;

    var bRoleQuery = new Parse.Query('_Role');
    bRoleQuery.equalTo("name", buyerID);

    var sRoleQuery = new Parse.Query('_Role');
    sRoleQuery.equalTo("name", sellerID);

    bRoleQuery.find({ useMasterKey: true }).then(function(bResults){
        var bRole = bResults[0];
        bRole.getUsers().remove(sellerObject);
        console.log("Seller removed from buyer role");
        return bRole.save(null, {useMasterKey:true});
    }).then(function(bSuccess){
        console.log("Buyer role saved");
        return sRoleQuery.find({ useMasterKey: true });
    }).then(function(sResults){
        var sRole = sResults[0];
        sRole.getUsers().remove(buyerObject);
        console.log("Buyer removed from seller role");
        return sRole.save(null, {useMasterKey:true});
    }).then(function(success){
        console.log("Seller role save");
        response.success(success);
    }, function(error){
        alert("Error" + error.code + " " + error.message);
        response.error(error);
    });
});

Parse.Cloud.define("deleteMessageNode", function(request, response){
    //Parse.Cloud.useMasterKey();

    var nodeID = request.params.nodeID;
    var buyerID = request.params.buyerID;
    var sellerID = request.params.sellerID;
    var bookID = request.params.bookID;
    var messageNode;

    var objectsToDelete = [];

    var buyerQuery = new Parse.Query("_User");
    var nodeQuery = new Parse.Query("MessageNode");

    nodeQuery.get(nodeID, { useMasterKey: true }).then(function(nodeObject){
        messageNode = nodeObject;
        var mRelation = nodeObject.relation("messages");
        var mQuery = mRelation.query();
        console.log("Fetched node object, resolved messages relation query");
        return mQuery.find({ useMasterKey: true });
    }).then(function(results){
        objectsToDelete.push.apply(objectsToDelete, results);
        objectsToDelete.push(messageNode);
        console.log("Retrieved and prepared messages/message node for deletion");
        return Parse.Object.destroyAll(objectsToDelete, { useMasterKey: true });
    }).then(function(result){
        console.log("Messages and message node deleted successfully");
        return buyerQuery.get(buyerID, { useMasterKey: true });
    }).then(function(buyerObject){
        var booksRequested = buyerObject.get("booksRequested");
        buyerObject.set("booksRequested", booksRequested.filter(function(el){return el !== bookID}));
        console.log("Books req. retrieved and book ID removed");
        return buyerObject.save(null, {useMasterKey:true});
    }).then(function(saved){
        console.log("Buyer object saved.");
        var nodePar = {buyerID: buyerID, sellerID: sellerID};
        return Parse.Cloud.run('checkRemainingNodes', nodePar);
    }).then(function(cloudResp){
        response.success(true);
    }, function(error){
        alert("Error" + error.code + " " + error.message);
        response.error(error);
    });

});

Parse.Cloud.define("checkRemainingNodes", function(request, response){
    //Parse.Cloud.useMasterKey();

    var buyerID = request.params.buyerID;
    var sellerID = request.params.sellerID;

    var userObject = new Parse.Object.extend("_User");
    var buyerObject = new userObject();
    buyerObject.id = buyerID;

    var sellerObject = new userObject();
    sellerObject.id = sellerID;

    var checkQuery1 = new Parse.Query("MessageNode");
    checkQuery1.equalTo("buyer", buyerObject);
    checkQuery1.equalTo("seller", sellerObject);

    var checkQuery2 = new Parse.Query("MessageNode");
    checkQuery2.equalTo("buyer", sellerObject);
    checkQuery2.equalTo("seller", buyerObject);

    var checkQuery = new Parse.Query.or(checkQuery1, checkQuery2);
    checkQuery.find({ useMasterKey: true }).then(function(results){
        if (results.length == 0){
            console.log("Check finished. No other nodes found.")
            var remRolesParams = {buyerID: buyerID, sellerID: sellerID};
            Parse.Cloud.run("removeFromRoles", remRolesParams).then(function(result){
                console.log("Roles reconfigured for privacy");
                response.success(true);
            }, function(error){
                alert("Error" + error.code + " " + error.message);
                response.error(error);
            });
        }
        else{
            console.log("Other nodes found. Roles will not change");
            response.success(true);
        }
    }, function(error){
        if (error.code == 101){
            response.success(true);
        }
        else{
            alert("Error" + error.code + " " + error.message);
            response.error(error);
        }
    });

});

Parse.Cloud.define("checkUsername", function(request, response){
    //Parse.Cloud.useMasterKey();

    var username = request.params.username;

    var userQuery = new Parse.Query("_User");
    userQuery.equalTo("username", username);
    userQuery.find({ useMasterKey: true }).then(function(result){
        console.log(result.length);
        if (result.length > 0){
            response.success(false);
        }
        else{
            response.success(true);
        }
    }, function(error){
        alert("Error" + error.code + " " + error.message);
        response.error(error);
    });
});

Parse.Cloud.define("incrementBookView", function(request, response){
    //Parse.Cloud.useMasterKey();

    bookID = request.params.bookID;
    userID = request.params.userID;

    var bookQuery = new Parse.Query("Book");
    bookQuery.get(bookID, { useMasterKey: true }).then(function(bookObject){
        var viewedBy;
        if (bookObject.get("viewedBy") != null){
            viewedBy = bookObject.get("viewedBy");
            viewedBy.push(userID);
            bookObject.set("viewedBy", viewedBy);
            console.log("Adding user");
        }
        else{
            console.log("Creating and adding user");
            viewedBy = [userID];
            bookObject.set("viewedBy", viewedBy);
        }
        console.log("Saving book");
        return bookObject.save(null, {useMasterKey:true});
    }).then(function(saved){
        console.log("Saved successfully");
        response.success(saved);
    }, function(error){
        alert("Error" + error.code + " " + error.message);
        response.error(error);
    });
});

Parse.Cloud.define("getUsername", function(request, response){
    //Parse.Cloud.useMasterKey();

    var email = request.params.email;

    var query = new Parse.Query("ContactInfo");
    query.equalTo("email", email);
    query.find({ useMasterKey: true }).then(function(contactObject){
        if (contactObject[0] != null){
            response.success(contactObject[0].get("username").toString());
        }
        else{
            response.success(false);
        }
    }, function (error) {
        alert("Error" + error.code + " " + error.message);
        response.error(error);
    })
});

Parse.Cloud.define("sendEmailForBook", function(request, response) {

    var email = request.params.email;
    var bookTitle = request.params.bookTitle;
    var html = "<!DOCTYPE html PUBLIC '-//W3C//DTD XHTML 1.0 Transitional//EN' 'http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd'> <html xmlns='http://www.w3.org/1999/xhtml' style='font-family: Helvetica Neue, Helvetica, Arial, sans-serif; box-sizing: border-box; font-size: 14px; margin: 0;'> <head> <meta name='viewport' content='width=device-width' /> <meta http-equiv='Content-Type' content='text/html; charset=UTF-8' /> <title>Textbooks 101 - New Message</title> <link rel='stylesheet' type='text/css' href='http://101textbooks.com/css/fonts.css'> <style type='text/css'> img { max-width: 100%; } body { -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: none; width: 100% !important; height: 100%; line-height: 1.6em; } body { background-color: #f6f6f6; } @media only screen and (max-width: 640px) { body { padding: 0 !important; } h1 { font-weight: 800 !important; margin: 20px 0 5px !important; } h2 { font-weight: 800 !important; margin: 20px 0 5px !important; } h3 { font-weight: 800 !important; margin: 20px 0 5px !important; } h4 { font-weight: 800 !important; margin: 20px 0 5px !important; } h1 { font-size: 22px !important; } h2 { font-size: 18px !important; } h3 { font-size: 16px !important; } .container { padding: 0 !important; width: 100% !important; } .content { padding: 0 !important; } .content-wrap { padding: 10px !important; } .invoice { width: 100% !important; } } </style> </head> <body itemscope itemtype='http://schema.org/EmailMessage' style='font-family: Helvetica Neue,Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: none; width: 100% !important; height: 100%; line-height: 1.6em; background-color: #f6f6f6; margin: 0;' bgcolor='#f6f6f6'> <table class='body-wrap' style='font-family: Helvetica Neue,Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; width: 100%; background-color: #f6f6f6; margin: 0;' bgcolor='#f6f6f6'><tr style='font-family: Helvetica Neue,Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; margin: 0;'><td style='font-family: Helvetica Neue,Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; vertical-align: top; margin: 0;' valign='top'></td> <td class='container' width='600' style='font-family: Helvetica Neue,Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; vertical-align: top; display: block !important; max-width: 600px !important; clear: both !important; margin: 0 auto;' valign='top'> <div class='content' style='font-family: Helvetica Neue,Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; max-width: 600px; display: block; margin: 0 auto; padding: 20px;'> <table class='main' width='100%' cellpadding='0' cellspacing='0' style='font-family: Helvetica Neue,Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; border-radius: 3px; background-color: #fff; margin: 0; border: 1px solid #e9e9e9;' bgcolor='#fff'><tr style='font-family: Helvetica Neue,Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; margin: 0;'><td class='alert alert-warning' style='font: KGTangledUpInYou; font-family: KGTangledUpInYou; font-size: 45px; vertical-align: top; color: #fff; text-align: center; border-radius: 3px 3px 0 0; background: url(http://101textbooks.com/images/email/header_back.png); background-size: 100% 100%; margin-top: 10px; padding: 20px; padding-top: 35px;' align='center' valign='top'> Textbooks 101 </td> </tr><tr style='font-family: Helvetica Neue,Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; margin: 0;'><td class='content-wrap' style='font-family: Helvetica Neue,Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; vertical-align: top; margin: 0; padding: 20px;' valign='top'> <table width='100%' cellpadding='0' cellspacing='0' style='font-family: Helvetica Neue,Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; margin: 0; text-align: center;'><tr style='font-family: Helvetica Neue,Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; margin: 0;'><td class='content-block' style='font-family: Helvetica Neue,Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 16px; vertical-align: top; margin: 0; padding: 15px 0px 20px;' valign='top'> Hey! You have a <strong>new message</strong> on Textbooks 101 for <strong style='font-family: Helvetica Neue,Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; margin: 0;'>" + bookTitle + "</strong>. </td> </tr><tr style='font-family: Helvetica Neue,Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; margin: 0;'><td class='content-block' style='font-family: Helvetica Neue,Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; vertical-align: top; margin: 0; padding: 0 0 20px;' valign='top'> <a href='textbooks101://' class='btn-primary' style='font-family: Helvetica Neue,Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 16px; color: #FFF; text-decoration: none; line-height: 2em; font-weight: bold; text-align: center; cursor: pointer; display: inline-block; border-radius: 5px; text-transform: capitalize; background-color: #348eda; margin: 0; border-color: #348eda; border-style: solid; border-width: 10px 20px; padding: 0px 20px;'>Open Textbooks 101</a><br><p style='font-size: 12px; padding: 0px; margin: 0px;'>(You must have at least version 1.9.7 for this button to work.)</p> </td> </tr><tr style='font-family: Helvetica Neue,Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; margin: 0;'><td class='content-block' style='font-family: Helvetica Neue,Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 16px; vertical-align: top; margin: 0; padding: 0 0 20px;' valign='top'> <strong>We hope you enjoy using Textbooks 101!</strong> </td> </tr></table></td> </tr></table><div class='footer' style='font-family: Helvetica Neue,Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; width: 100%; clear: both; color: #999; margin: 0; padding: 20px;'> <table width='100%' style='font-family: Helvetica Neue,Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; margin: 0;'><tr style='font-family: Helvetica Neue,Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; margin: 0;'><td class='aligncenter content-block' style='font-family: Helvetica Neue,Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 12px; vertical-align: top; color: #999; text-align: center; margin: 0; padding: 0 0 20px;' align='center' valign='top'><a href='' style='font-family: Helvetica Neue,Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 12px; color: #999; text-decoration: underline; margin: 0;'>Unsubscribe</a> from these alerts.</td> </tr></table></div></div> </td> <td style='font-family: Helvetica Neue,Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; vertical-align: top; margin: 0;' valign='top'></td> </tr></table></body> </html>";
	
	console.log("BEGINNING EMAIL SEND");
	console.log("Sending email to " + email);
    client.sendEmail({
        to: email,
        from: "no-reply@textbooks101.ca",
        subject: "New Message on Textbooks 101",
        html: html,
        "o:tag": "New Book Message"
    }).then(function(httpResponse) {
    	console.log("SUCCESS EMAIL");
        response.success(true);
    }, function(httpResponse) {
        alert("Error" + httpResponse);
        console.log("ERROR" + httpResponse);
        response.success(true);
    });
});

Parse.Cloud.define("sendEmailToUser", function(request, response) {

    var email = request.params.email;
    response.success(true);

    var body = "";


    // client.sendEmail({
    //     to: email,
    //     from: "no-reply@textbooks101.ca",
    //     subject: "Textbooks 101 - Email Verification",
    //     text: "Hello! Thank you for joining Textbooks 101. Please follow the link below to verify your account."
    // }).then(function(httpResponse) {
    //     response.success(true);
    // }, function(httpResponse) {
    //     alert("Error" + httpResponse);
    //     response.success(true);
    // });
});

Parse.Cloud.define("sendPasswordResetEmail", function(request, response) {

    response.success(true);
    // var email = request.params.email;
    //
    // client.sendEmail({
    //     to: email,
    //     from: "no-reply@textbooks101.ca",
    //     subject: "Textbooks 101 - Email Verification",
    //     text: "Hello! Thank you for joining Textbooks 101. Please follow the link below to verify your account."
    // }).then(function(httpResponse) {
    //     response.success(true);
    // }, function(httpResponse) {
    //     alert("Error" + httpResponse);
    //     response.success(true);
    // });
});

Parse.Cloud.define("finishSignUp", function(request, response){
    //Parse.Cloud.useMasterKey();

    var userID = request.params.userID;
    var email = request.params.email;

    var userObject;

    // Parse.Cloud.run("emailExists", {"email":email}).then(function(exists) {
    //     if (exists){
    //         response.success("Sorry, it seems " + email.toString() + " has already been registered." +
    //             " If you believe this is an error, please contact us at support@textbooks101.ca");
    //     }
    //     var uoQuery = new Parse.Query("_User");
    //     return
    var uoQuery = new Parse.Query("_User");
    uoQuery.get(userID, { useMasterKey: true }).then(function(uResult) {
        if (uResult != null){
            console.log("Userobject retrieved, creating Roles, Contact Info, and User Settings");
            userObject = uResult;
        }
        else{
            alert("Error " + "User object not found in finish sign up");
            response.error("User object not found in finish sign up");
        }

        var rQuery = new Parse.Query("_Role");
        rQuery.equalTo("name", userID);
        return rQuery.find({ useMasterKey: true });
    }).then(function(rResults){
        var role;

        if (rResults[0] != null){
            console.log("Role already exists, continuing with existing");
            role = rResults[0];
        }
        else{
            console.log("No role found, creating new");
            var rAcl = new Parse.ACL();
            rAcl.setPublicWriteAccess(false);
            rAcl.setPublicReadAccess(false);
            rAcl.setWriteAccess(userID, true);
            rAcl.setReadAccess(userID, true);

            role = new Parse.Role(userID, rAcl);
            role.getUsers().add(userObject);
            role.set("name", userID);
        }

        var username = epicRandomString(20); //TB 101 unique

        var cACL = new Parse.ACL();
        cACL.setPublicReadAccess(false);
        cACL.setPublicWriteAccess(false);
        cACL.setWriteAccess(userID, true);
        cACL.setReadAccess(userID, true);

        var contactInfo = new Parse.Object("ContactInfo", cACL);
        contactInfo.set("forUser", userObject);
        contactInfo.set("email", userObject.getEmail());
        contactInfo.set("username", username); //TB 101 unique

        var uACL = new Parse.ACL();
        uACL.setPublicReadAccess(!userObject.get("anonymous"));
        uACL.setPublicWriteAccess(false);
        uACL.setWriteAccess(userID, true);
        uACL.setReadAccess(role, true);

        userObject.set("contactInfo", contactInfo);
        userObject.set("userRole", role);
        userObject.set("signUpComplete", true);
        userObject.set("promoExcluded", false);
        userObject.setACL(uACL);
        userObject.unset("email");
        userObject.set("username", username); //TB 101 unique

        var saveRoleAndSettings  = [];
        saveRoleAndSettings.push(contactInfo);
        saveRoleAndSettings.push(userObject);
        saveRoleAndSettings.push(role);

        return Parse.Object.saveAll(saveRoleAndSettings, { useMasterKey: true })
    }).then(function(sResult) {
        console.log("All objects saved, task completed");
        return Parse.Cloud.run("sendEmailToUser", {"email":email});
    }).then(function (eSuccess) {
        console.log("Successfully sent verification email");
        response.success(true);
    }, function(error){
        alert("Error" + error.code + " " + error.message);
        response.error(error);
    });
});

Parse.Cloud.define("emailExists", function(request, response){
    //Parse.Cloud.useMasterKey();

    var email = request.params.email;

    var userQuery = new Parse.Query("ContactInfo");
    userQuery.equalTo("email", email);
    userQuery.find({ useMasterKey: true }).then(function(result){
        if (result[0] != null) {
            console.log("Email found, returning true");
            response.success(true);
        }
        else{
            response.success(false);
            console.log("Email not found, returning false");
        }
    }, function(error) {
        alert("Error" + error.code + " " + error.message);
        response.error(error);
    });
});

function epicRandomString(b){for(var a=(Math.random()*eval("1e"+~~(50*Math.random()+50))).toString(36).split(""),c=3;c<a.length;c++)c==~~(Math.random()*c)+1&&a[c].match(/[a-z]/)&&(a[c]=a[c].toUpperCase());a=a.join("");a=a.substr(~~(Math.random()*~~(a.length/3)),~~(Math.random()*(a.length-~~(a.length/3*2)+1))+~~(a.length/3*2));if(24>b)return b?a.substr(a,b):a;a=a.substr(a,b);if(a.length==b)return a;for(;a.length<b;)a+=epicRandomString();return a.substr(0,b)};