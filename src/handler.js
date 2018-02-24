const fs = require('fs')
const path = require('path')

const Email = require('./http/Email')
const Encrypter = require('./common/Encrypter')
const Log = require('./common/Log')
const Request = require('./http/Request')
const Response = require('./http/Response')

const aws = require('./services/AwsService')
const config = require('../config.json')

module.exports.handle = (event, context, callback) => {
  const encrypter = new Encrypter(getEncryptionKey())
  const request = new Request(event, encrypter)

  let paramCount = Object.keys(request.userParameters).length
  Log.info(`${request.responseFormat} request received with ${paramCount} parameters`)

  request.validate()
    .then(function () {
      let recipientCount = request.recipients.cc.length + request.recipients.bcc.length + request.recipients.replyTo.length
      Log.info(`sending to '${request.recipients.to}' and ${recipientCount} other recipients`)
      return aws.sendEmail(new Email(getSenderArn(), getSubject()).build(request.recipients, request.userParameters))
    })
    .then(function () {
      const statusCode = request.redirectUrl ? 302 : 200
      const message = config.MSG_RECEIVE_SUCCESS || 'Form submission successfully made'
      return Promise.resolve(new Response(statusCode, message))
    })
    .catch(function (error) {
      Log.error('error was caught while executing receive lambda', error)
      const response = new Response(error.statusCode, error.message)
      return Promise.resolve(response)
    })
    .then(function (response) {
      Log.info(`returning http ${response.statusCode} response`)
      if (request.responseFormat === 'json') {
        callback(null, response.buildJson())
        return
      }
      if (request.responseFormat === 'plain' && request.redirectUrl) {
        callback(null, response.buildRedirect(request.redirectUrl))
        return
      }
      if (request.responseFormat === 'html') {
        const template = fs.readFileSync(path.resolve(__dirname, './http/template.html')).toString()
        callback(null, response.buildHtml(template))
        return
      }
    })
}

function getEncryptionKey () {
  if ('ENCRYPTION_KEY' in config && config.ENCRYPTION_KEY !== '') {
    return config.ENCRYPTION_KEY
  } else {
    Log.error("please set 'ENCRYPTION_KEY' in 'config.json'")
    return ''
  }
}

function getSenderArn () {
  if ('SENDER_ARN' in config && config.SENDER_ARN !== '') {
    return config.SENDER_ARN
  } else {
    Log.error("please set 'SENDER_ARN' in 'config.json'")
    return ''
  }
}

function getSubject () {
  if ('MSG_SUBJECT' in config && config.MSG_SUBJECT !== '') {
    return config.MSG_SUBJECT
  } else {
    return 'You have a form submission'
  }
}
