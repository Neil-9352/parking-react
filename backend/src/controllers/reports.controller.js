const pool = require('../db');

// Whitelisted sort columns to prevent SQL injection
const RECORD_SORT_COLS = {
  in_time:  'pi.in_time',
  out_time: 'pi.out_time',
  fee:      'pi.fee',
};

const FEE_SORT_COLS = {
  first_hour_charge: 'first_hour_charge',
  rest_hour_charge:  'rest_hour_charge',
  created_at:        'created_at',
};

// GET /api/reports
async function getReports(req, res) {
  const lot_id = req.admin.lot_id;
  const { reg_number, date, min_fee, max_fee, from_date, to_date } = req.query;

  const page      = Math.max(1, parseInt(req.query.page)       || 1);
  const feePage   = Math.max(1, parseInt(req.query.fee_page)   || 1);
  const limit     = 10;
  const offset    = (page - 1) * limit;
  const feeOffset = (feePage - 1) * limit;

  // Sort params — default to id ASC / fee_id ASC
  const sortBy    = RECORD_SORT_COLS[req.query.sort_by]    || 'pi.id';
  const sortDir   = req.query.sort_dir === 'desc' ? 'DESC' : 'ASC';
  const feeSortBy = FEE_SORT_COLS[req.query.fee_sort_by]   || 'fee_id';
  const feeSortDir = req.query.fee_sort_dir === 'desc' ? 'DESC' : 'ASC';

  try {
    // ── Parking records ──────────────────────────────────────────
    let baseWhere = 'WHERE pi.lot_id = ?';
    const baseParams = [lot_id];

    if (reg_number) { baseWhere += ' AND pi.registration_number = ?'; baseParams.push(reg_number); }
    if (date)       { baseWhere += ' AND DATE(pi.in_time) = ?';        baseParams.push(date); }
    if (min_fee !== undefined && min_fee !== '') { baseWhere += ' AND pi.fee >= ?'; baseParams.push(parseFloat(min_fee)); }
    if (max_fee !== undefined && max_fee !== '') { baseWhere += ' AND pi.fee <= ?'; baseParams.push(parseFloat(max_fee)); }
    if (from_date)  { baseWhere += ' AND DATE(pi.in_time) >= ?';       baseParams.push(from_date); }
    if (to_date)    { baseWhere += ' AND DATE(pi.in_time) <= ?';       baseParams.push(to_date); }

    const countSql  = `SELECT COUNT(*) AS total FROM parks_in pi LEFT JOIN vehicle v ON pi.registration_number = v.registration_number ${baseWhere}`;
    const recordSql = `SELECT pi.*, v.type FROM parks_in pi LEFT JOIN vehicle v ON pi.registration_number = v.registration_number ${baseWhere} ORDER BY ${sortBy} ${sortDir} LIMIT ? OFFSET ?`;

    const [[{ total: totalRecords }]] = await pool.query(countSql, baseParams);
    const [records] = await pool.query(recordSql, [...baseParams, limit, offset]);

    // ── Fee structure ─────────────────────────────────────────────
    const [[{ total: totalFees }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM fee WHERE lot_id = ?',
      [lot_id]
    );
    const [feeRows] = await pool.query(
      `SELECT * FROM fee WHERE lot_id = ? ORDER BY ${feeSortBy} ${feeSortDir} LIMIT ? OFFSET ?`,
      [lot_id, limit, feeOffset]
    );

    return res.status(200).json({
      records,
      totalRecords,
      page,
      fees: feeRows,
      totalFees,
      feePage,
      limit,
    });
  } catch (err) {
    console.error('Reports error:', err);
    return res.status(500).json({ error: 'Failed to fetch reports' });
  }
}

module.exports = { getReports };
