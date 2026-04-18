import { useParams } from 'react-router-dom';

import { MobileNodeDetailPage } from 'pages/mobile/node-shared';

export default function MobileRuntimeDetailPage() {
  const { flightNo } = useParams();
  return <MobileNodeDetailPage flowKey="flightRuntime" itemId={flightNo} backPath="/mobile/runtime" />;
}
