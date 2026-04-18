import { useParams } from 'react-router-dom';

import { MobileNodeDetailPage } from 'pages/mobile/node-shared';

export default function MobileHeadhaulDetailPage() {
  const { tripId } = useParams();
  return <MobileNodeDetailPage flowKey="headhaul" itemId={tripId} backPath="/mobile/headhaul" />;
}
