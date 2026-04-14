import { useParams } from 'react-router-dom';

import { MobileNodeDetailPage } from 'pages/mobile/node-shared';

export default function MobileDestinationRampDetailPage() {
  const { flightNo } = useParams();
  return <MobileNodeDetailPage flowKey="destinationRamp" itemId={flightNo} backPath="/mobile/destination-ramp" />;
}
