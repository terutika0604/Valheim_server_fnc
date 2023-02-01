'use strict';
//モジュール呼び出し
// LINEmessageAPI
const line = require('@line/bot-sdk');
// 署名検証
const crypto = require('crypto');
// AWSSDK
const AWS = require("aws-sdk");
AWS.config.update({ region: process.env.AWS_REGION });

// ec2のインスタンスID
const params = {
  InstanceIds: [process.env.INSTANCEID]
};

//LINEインスタンス生成
const client = new line.Client({ channelAccessToken: process.env.ACCESSTOKEN });

const startInstances = async (ec2) => {
  return new Promise((resolve, reject) => {
    ec2.startInstances(
      params,
      (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        resolve("スタートしました");
      }
    );
  });
};

const stopInstances = async (ec2) => {
  return new Promise((resolve, reject) => {
    ec2.stopInstances(
      params,
      (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        resolve("ストップしました");
      }
    );
  });
};

const checkInstances = async (ec2) => {
  return new Promise((resolve, reject) => {
    ec2.describeInstanceStatus(
      {
        InstanceIds: [process.env.INSTANCEID],
        IncludeAllInstances: true
      },
      (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(data.InstanceStatuses[0].InstanceState.Name);
      }
    );
  });
};


exports.handler = (event, context) => {
    // EC2インスタンス
    const ec2 = new AWS.EC2({ apiVersion: "2016-11-15" });

    //署名検証
    let signature = crypto.createHmac('sha256', process.env.CHANNELSECRET).update(event.body).digest('base64');
    let checkHeader = (event.headers || {})['X-Line-Signature'];
    if(!checkHeader){
        checkHeader = (event.headers || {})['x-line-signature'];
    }
    let body = JSON.parse(event.body);
    const events = body.events;
    console.log(events);

    //署名検証が成功した場合
    if (signature === checkHeader) {
      events.forEach(async (event) => {

      let userMessage;

      //イベントタイプごとに関数を分ける
      if(event.type == "postback") {
        //ポストバックイベント
        if(event.postback.data == "start") {
            userMessage = await startInstances(ec2);
        } else if(event.postback.data == "stop") {
            userMessage = await stopInstances(ec2);
        } else if(event.postback.data == "check") {
            userMessage = await checkInstances(ec2);
        }
      }
      
      let message;
      if(userMessage == null) {
        message = undefined;
      } else {
        message = {
          type: "text",
          text: userMessage
        };
      }

      //メッセージを返信
      if (message != undefined) {
          client.replyMessage(body.events[0].replyToken, message)
              .then((response) => {
                  let lambdaResponse = {
                      statusCode: 200,
                      headers: { "X-Line-Status": "OK" },
                      body: '{"result":"completed"}'
                  };
                  context.succeed(lambdaResponse);
              }).catch((err) => console.log(err));
      }
    });
  }

  //署名検証に失敗した場合
  else {
      console.log('署名認証エラー');
  }
};
