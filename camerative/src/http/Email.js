class Email {
    constructor(senderArn, subject, validator) {
        this.senderArn = senderArn;
        this.subject = subject;
        this.validator = validator
    }

    build(recipients, userParameters) {
        this._validateArn();

        return {
            Source:           this._buildSenderSource(),
            ReplyToAddresses: recipients.replyTo,
            Destination:      {
                ToAddresses:  [recipients.to],
                CcAddresses:  recipients.cc,
                BccAddresses: recipients.bcc
            },
            Message:          {
                Subject: {
                    Data: this.subject
                },
                Body:    {
                    Text: {
                        Data: this._buildMessageBody(userParameters)
                    }
                }
            }
        }
    }

    _validateArn() {
        let senderArnAsArray = this.senderArn.split(':');
        let identity = senderArnAsArray.length > 0 ? senderArnAsArray[senderArnAsArray.length - 1] : '';

        if (senderArnAsArray.length !== 6) {
            throw new Error('sender ARN is formatted incorrectly')
        }

        if (this.senderArn.substring(0, 3) !== 'arn') {
            throw new Error("sender ARN should start with 'arn'")
        }

        if (identity.length < 9) {
            throw new Error('sender ARN identity length is invalid')
        }

        if (!this.validator.isEmail(identity.substring(9))) {
            throw new Error('sender ARN identity email address is invalid')
        }
    }

    _buildSenderSource() {
        let senderArnAsArray = this.senderArn.split('/');
        let email = senderArnAsArray[senderArnAsArray.length - 1];
        return `Formplug <${email}>`
    }

    _buildMessageBody(userParameters) {
        return Object.keys(userParameters)
            .filter(function (param) {
                // don't send private variables
                return param.substring(0, 1) !== '_'
            })
            .reduce(function (message, param) {
                // uppercase the field names and add each parameter value
                message += param.toUpperCase() + ': ' + userParameters[param] + '\r\n';
                return message
            }, '')
    }
}

module.exports = Email;
