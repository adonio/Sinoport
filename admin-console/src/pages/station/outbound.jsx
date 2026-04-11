import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';

import BlockingReasonAlert from 'components/sinoport/BlockingReasonAlert';
import DocumentStatusCard from 'components/sinoport/DocumentStatusCard';
import LifecycleStepList from 'components/sinoport/LifecycleStepList';
import MainCard from 'components/MainCard';
import MetricCard from 'components/sinoport/MetricCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import TaskQueueCard from 'components/sinoport/TaskQueueCard';
import { ffmForecastRows, manifestRows, manifestSummary, masterAwbRows, outboundFlights, receiptRows, uwsRows } from 'data/sinoport';
import { outboundDocumentGates, outboundLifecycleRows, stationBlockerQueue } from 'data/sinoport-adapters';

export default function StationOutboundPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Outbound Ops"
          title="出港管理"
          description="出港后台按 PRD 拆成预报、接收、主单、装载、飞走、UWS 和 Manifest 板块，并补齐文件放行和任务阻断表达。"
          chips={['FFM', 'Receipt', 'MAWB', 'Loading', 'Airborne', 'UWS', 'Manifest', 'Gate Control']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/station/outbound/flights" variant="outlined">
                航班管理
              </Button>
              <Button component={RouterLink} to="/station/outbound/waybills" variant="outlined">
                提单管理
              </Button>
              <Button component={RouterLink} to="/station/documents" variant="outlined">
                单证与指令中心
              </Button>
            </Stack>
          }
        />
      </Grid>

      {[
        { title: '待飞走航班', value: `${outboundFlights.length}`, helper: '出港排班与装载协同中', chip: 'Flights', color: 'primary' },
        { title: 'Manifest 已导入', value: manifestSummary.version, helper: manifestSummary.exchange, chip: 'Docs', color: 'secondary' },
        { title: '出港货物数量', value: manifestSummary.outboundCount, helper: '来自 UWS 与 Manifest 汇总', chip: 'Outbound', color: 'success' },
        { title: '目的港到货数量', value: manifestSummary.destinationCount, helper: '等待目的港回传用于对账', chip: 'Arrival', color: 'warning' }
      ].map((item) => (
        <Grid key={item.title} size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard {...item} />
        </Grid>
        ))}

      <Grid size={{ xs: 12, lg: 7 }}>
        <MainCard title="出港航班总览">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>航班</TableCell>
                <TableCell>ETD</TableCell>
                <TableCell>阶段</TableCell>
                <TableCell>Manifest</TableCell>
                <TableCell>货量</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {outboundFlights.map((item) => (
                <TableRow key={item.flightNo} hover>
                  <TableCell>{item.flightNo}</TableCell>
                  <TableCell>{item.etd}</TableCell>
                  <TableCell>
                    <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
                      <StatusChip label={item.status} />
                      <Typography variant="caption" color="text.secondary">
                        {item.stage}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{item.manifest}</TableCell>
                  <TableCell>{item.cargo}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 5 }}>
        <MainCard title="出港状态链">
          <LifecycleStepList steps={outboundLifecycleRows} />
        </MainCard>
      </Grid>

      <Grid size={12}>
        <BlockingReasonAlert title="当前出港阻断" reasons={stationBlockerQueue.map((item) => item.title)} />
      </Grid>

      <Grid size={{ xs: 12, xl: 6 }}>
        <MainCard title="1. 货物预报 FFM">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>AWB</TableCell>
                <TableCell>目的站</TableCell>
                <TableCell>件数</TableCell>
                <TableCell>重量</TableCell>
                <TableCell>货描</TableCell>
                <TableCell>ULD</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ffmForecastRows.map((item) => (
                <TableRow key={item.awb} hover>
                  <TableCell>{item.awb}</TableCell>
                  <TableCell>{item.destination}</TableCell>
                  <TableCell>{item.pieces}</TableCell>
                  <TableCell>{item.weight}</TableCell>
                  <TableCell>{item.goods}</TableCell>
                  <TableCell>{item.uld}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 6 }}>
        <MainCard title="2. 货物接收">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>AWB</TableCell>
                <TableCell>预报</TableCell>
                <TableCell>实收</TableCell>
                <TableCell>结果</TableCell>
                <TableCell>差异</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {receiptRows.map((item) => (
                <TableRow key={item.awb} hover>
                  <TableCell>{item.awb}</TableCell>
                  <TableCell>{item.planned}</TableCell>
                  <TableCell>{item.actual}</TableCell>
                  <TableCell>
                    <StatusChip label={item.result} />
                  </TableCell>
                  <TableCell>{item.issue}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 6 }}>
        <MainCard title="3. 货物主单">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>AWB</TableCell>
                <TableCell>发货人</TableCell>
                <TableCell>收货人</TableCell>
                <TableCell>航段</TableCell>
                <TableCell>件数</TableCell>
                <TableCell>重量</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {masterAwbRows.map((item) => (
                <TableRow key={item.awb} hover>
                  <TableCell>{item.awb}</TableCell>
                  <TableCell>{item.shipper}</TableCell>
                  <TableCell>{item.consignee}</TableCell>
                  <TableCell>{item.route}</TableCell>
                  <TableCell>{item.pcs}</TableCell>
                  <TableCell>{item.weight}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 6 }}>
        <MainCard title="4-6. 装载 / 飞走 / 装载信息 UWS">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>AWB</TableCell>
                <TableCell>ULD</TableCell>
                <TableCell>PCS</TableCell>
                <TableCell>GW</TableCell>
                <TableCell>POD</TableCell>
                <TableCell>Destination</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {uwsRows.map((item) => (
                <TableRow key={`${item.awb}-${item.uld}`} hover>
                  <TableCell>{item.awb}</TableCell>
                  <TableCell>{item.uld}</TableCell>
                  <TableCell>{item.pcs}</TableCell>
                  <TableCell>{item.weight}</TableCell>
                  <TableCell>{item.pod}</TableCell>
                  <TableCell>{item.destination}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={12}>
        <DocumentStatusCard title="出港文件放行" items={outboundDocumentGates} />
      </Grid>

      <Grid size={12}>
        <MainCard title="7. Manifest">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>航班</TableCell>
                <TableCell>ULD / PMC</TableCell>
                <TableCell>AWB</TableCell>
                <TableCell>件数</TableCell>
                <TableCell>毛重</TableCell>
                <TableCell>路由</TableCell>
                <TableCell>货类</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {manifestRows.map((item) => (
                <TableRow key={`${item.flightNo}-${item.awb}`} hover>
                  <TableCell>{item.flightNo}</TableCell>
                  <TableCell>{item.uld}</TableCell>
                  <TableCell>{item.awb}</TableCell>
                  <TableCell>{item.pieces}</TableCell>
                  <TableCell>{item.weight}</TableCell>
                  <TableCell>{item.route}</TableCell>
                  <TableCell>{item.type}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={12}>
        <TaskQueueCard
          title="出港任务提示"
          items={[
            {
              id: 'OUT-001',
              title: 'SE913 Manifest 最终版待冻结',
              description: 'Manifest 仍为待生成状态，不能进入飞走归档。',
              status: '待处理'
            },
            {
              id: 'OUT-002',
              title: '装机复核待完成',
              description: '缺少 Loaded 照片与独立复核签名。',
              status: '警戒'
            }
          ]}
        />
      </Grid>
    </Grid>
  );
}
