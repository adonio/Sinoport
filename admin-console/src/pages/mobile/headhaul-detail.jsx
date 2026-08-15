import { useParams } from 'react-router-dom';

import { V14MobileDetailPage } from 'pages/mobile/v14-execution-shared';

export default function MobileHeadhaulDetailPage() {
  const { tripId } = useParams();
  return <V14MobileDetailPage kind="transport" itemId={tripId} />;
}
