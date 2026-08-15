import { useParams } from 'react-router-dom';

import { V14MobileDetailPage } from './v14-execution-shared';

export default function MobileTasFlightDetailPage() {
  const { handlingId } = useParams();
  return <V14MobileDetailPage kind="tasFlight" itemId={handlingId} />;
}
