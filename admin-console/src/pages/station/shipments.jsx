import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { Link as RouterLink } from 'react-router-dom';

import MainCard from 'components/MainCard';
import MetricCard from 'components/sinoport/MetricCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { useGetStationShipments } from 'api/station';
import { exceptionDetailRows, shipmentRows } from 'data/sinoport-adapters';

function getShipmentExceptionPath(shipmentId) {
  const matched = exceptionDetailRows.find((item) => item.objectTo === `/station/shipments/${shipmentId}`);
  return matched ? `/station/exceptions/${matched.id}` : '/station/exceptions';
}

export default function StationShipmentsPage() {
  const { stationShipments } = useGetStationShipments();
  const rows = stationShipments?.length ? stationShipments : shipmentRows;
  const metrics = [
    { title: '履约对象总数', value: `${rows.length}`, helper: '统一按 Shipment / AWB 观察进港与出港链路', chip: 'Objects', color: 'primary' },
    { title: '进港对象', value: `${rows.filter((item) => item.direction === '进港').length}`, helper: '重点跟踪 Inbound Handling 与 NOA', chip: 'Inbound', color: 'secondary' },
    { title: '出港对象', value: `${rows.filter((item) => item.direction === '出港').length}`, helper: '重点跟踪 Loaded / Airborne / Manifest', chip: 'Outbound', color: 'success' },
    { title: '存在阻断', value: `${rows.filter((item) => item.blocker !== '无').length}`, helper: '需要文件、异常或复核解除后才能继续', chip: 'Blocked', color: 'warning' }
  ];

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Shipment Chain"
          title="提单与履约链路"
          description="把进港与出港提单统一成 Shipment / AWB 视图，围绕对象、状态、任务、文件和异常形成一条完整履约链路。"
          chips={['Shipment / AWB', 'Object Detail', 'Documents', 'Tasks', 'Exceptions']}
          action={
            <Button component={RouterLink} to="/station/documents" variant="outlined">
              查看单证门槛
            </Button>
          }
        />
      </Grid>

      {metrics.map((item) => (
        <Grid key={item.title} size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard {...item} />
        </Grid>
      ))}

      <Grid size={12}>
        <MainCard title="履约对象目录">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>对象</TableCell>
                <TableCell>方向</TableCell>
                <TableCell>所属航班</TableCell>
                <TableCell>主状态</TableCell>
                <TableCell>任务状态</TableCell>
                <TableCell>单证状态</TableCell>
                <TableCell>阻断原因</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    {item.awb}
                  </TableCell>
                  <TableCell>{item.direction}</TableCell>
                  <TableCell>{item.flightNo}</TableCell>
                  <TableCell>
                    <StatusChip label={item.primaryStatus} />
                  </TableCell>
                  <TableCell>
                    <StatusChip label={item.taskStatus} />
                  </TableCell>
                  <TableCell>
                    <StatusChip label={item.documentStatus} />
                  </TableCell>
                  <TableCell>{item.blocker}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
                      <Button component={RouterLink} to={`/station/shipments/${encodeURIComponent(item.id)}`} size="small" variant="contained">
                        查看链路
                      </Button>
                      <Button component={RouterLink} to="/station/documents" size="small" variant="outlined">
                        单证
                      </Button>
                      <Button component={RouterLink} to="/station/tasks" size="small" variant="outlined">
                        任务
                      </Button>
                      <Button component={RouterLink} to={getShipmentExceptionPath(item.id)} size="small" variant="outlined">
                        异常
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
    </Grid>
  );
}
