import { Stack, type StackProps } from 'aws-cdk-lib';
import { EmailIdentity, Identity } from 'aws-cdk-lib/aws-ses';
import type { Construct } from 'constructs';

export interface NotificationsStackProps extends StackProps {
  /** Sender of the monthly summary. In the SES sandbox, recipients must be verified too. */
  senderEmail: string;
}

export class NotificationsStack extends Stack {
  constructor(scope: Construct, id: string, props: NotificationsStackProps) {
    super(scope, id, props);

    // SES emails a verification link to this address on the first deploy.
    new EmailIdentity(this, 'SenderIdentity', {
      identity: Identity.email(props.senderEmail),
    });
  }
}
