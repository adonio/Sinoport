import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import { objectRelationshipRows } from 'data/sinoport-adapters';

export default function PlatformMasterDataRelationshipsPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Object Relationships"
          title="对象关系总览"
          description="统一展示 Flight、AWB、ULD/PMC、Truck、POD、Event 之间的核心关系，作为第三批的对象追溯基线。"
          chips={['Flight', 'Shipment/AWB', 'ULD/PMC', 'Truck', 'POD', 'Event']}
        />
      </Grid>
      <Grid size={12}>
        <MainCard title="对象关系链">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Source</TableCell>
                <TableCell>Relation</TableCell>
                <TableCell>Target</TableCell>
                <TableCell>说明</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {objectRelationshipRows.map((item) => (
                <TableRow key={`${item.source}-${item.target}`} hover>
                  <TableCell>{item.source}</TableCell>
                  <TableCell>{item.relation}</TableCell>
                  <TableCell>{item.target}</TableCell>
                  <TableCell>{item.note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
    </Grid>
  );
}
