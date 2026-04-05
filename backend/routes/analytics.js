// ============================================================
// analytics.js
// ============================================================
const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const { Contact, Staff, Service, ChatMessage } = require('../models/index');
const { protect } = require('../middleware/auth');

router.use(protect);

// Dashboard stats
router.get('/dashboard', async (req, res, next) => {
  try {
    const businessId = req.user.business;
    const now = new Date();
    const startOfToday = new Date(now); startOfToday.setHours(0,0,0,0);
    const endOfToday = new Date(now); endOfToday.setHours(23,59,59,999);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      todayApts,
      monthApts,
      lastMonthApts,
      totalContacts,
      pendingApts,
      completedApts,
      revenueAgg,
      topServices,
      statusDistribution,
      sourceDistribution,
      dailyTrend,
    ] = await Promise.all([
      Appointment.countDocuments({ business: businessId, scheduledAt: { $gte: startOfToday, $lte: endOfToday } }),
      Appointment.countDocuments({ business: businessId, scheduledAt: { $gte: startOfMonth } }),
      Appointment.countDocuments({ business: businessId, scheduledAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } }),
      Contact.countDocuments({ business: businessId, status: 'active' }),
      Appointment.countDocuments({ business: businessId, status: 'pending' }),
      Appointment.countDocuments({ business: businessId, status: 'completed' }),
      Appointment.aggregate([
        { $match: { business: businessId, status: 'completed', scheduledAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$servicePrice' } } },
      ]),
      Appointment.aggregate([
        { $match: { business: businessId, scheduledAt: { $gte: startOfMonth } } },
        { $group: { _id: '$serviceName', count: { $sum: 1 }, revenue: { $sum: '$servicePrice' } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
      Appointment.aggregate([
        { $match: { business: businessId, scheduledAt: { $gte: startOfMonth } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Appointment.aggregate([
        { $match: { business: businessId, scheduledAt: { $gte: startOfMonth } } },
        { $group: { _id: '$source', count: { $sum: 1 } } },
      ]),
      Appointment.aggregate([
        { $match: { business: businessId, scheduledAt: { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$scheduledAt' } },
          count: { $sum: 1 },
          revenue: { $sum: '$servicePrice' },
        }},
        { $sort: { _id: 1 } },
      ]),
    ]);

    const monthRevenue = revenueAgg[0]?.total || 0;
    const growthRate = lastMonthApts > 0 ? (((monthApts - lastMonthApts) / lastMonthApts) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      data: {
        kpis: {
          todayAppointments: todayApts,
          monthAppointments: monthApts,
          monthRevenue,
          totalContacts,
          pendingAppointments: pendingApts,
          completedAppointments: completedApts,
          growthRate: parseFloat(growthRate),
          completionRate: monthApts > 0 ? ((completedApts / monthApts) * 100).toFixed(1) : 0,
        },
        topServices,
        statusDistribution,
        sourceDistribution,
        dailyTrend,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Revenue analytics
router.get('/revenue', async (req, res, next) => {
  try {
    const { period = '30d' } = req.query;
    const businessId = req.user.business;
    const daysMap = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
    const days = daysMap[period] || 30;
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const revenue = await Appointment.aggregate([
      { $match: { business: businessId, status: 'completed', scheduledAt: { $gte: fromDate } } },
      { $group: {
        _id: { $dateToString: { format: days <= 30 ? '%Y-%m-%d' : '%Y-%m', date: '$scheduledAt' } },
        revenue: { $sum: '$servicePrice' },
        count: { $sum: 1 },
      }},
      { $sort: { _id: 1 } },
    ]);

    res.json({ success: true, data: revenue });
  } catch (err) {
    next(err);
  }
});

router.get('/chatbot', async (req, res, next) => {
  try {
    const { period = '30d' } = req.query;
    const businessId = req.user.business;
    const daysMap = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
    const days = daysMap[period] || 30;
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      botMessagesSent,
      failedDeliveries,
      botHandledContactsAgg,
      bookingsCreated,
      botRepliesTrend,
      bookingsTrend,
      stageDropoff,
      avgResponseAgg,
    ] = await Promise.all([
      ChatMessage.countDocuments({
        business: businessId,
        direction: 'outbound',
        sentBy: 'bot',
        createdAt: { $gte: fromDate },
      }),
      ChatMessage.countDocuments({
        business: businessId,
        direction: 'outbound',
        sentBy: 'bot',
        status: 'failed',
        createdAt: { $gte: fromDate },
      }),
      ChatMessage.aggregate([
        {
          $match: {
            business: businessId,
            direction: 'outbound',
            sentBy: 'bot',
            createdAt: { $gte: fromDate },
          },
        },
        { $group: { _id: '$contact' } },
        { $count: 'count' },
      ]),
      Appointment.countDocuments({
        business: businessId,
        source: 'whatsapp',
        createdAt: { $gte: fromDate },
      }),
      ChatMessage.aggregate([
        {
          $match: {
            business: businessId,
            direction: 'outbound',
            sentBy: 'bot',
            createdAt: { $gte: fromDate },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: days <= 30 ? '%Y-%m-%d' : '%Y-%m', date: '$createdAt' } },
            messages: { $sum: 1 },
            failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Appointment.aggregate([
        {
          $match: {
            business: businessId,
            source: 'whatsapp',
            createdAt: { $gte: fromDate },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: days <= 30 ? '%Y-%m-%d' : '%Y-%m', date: '$createdAt' } },
            bookings: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Contact.aggregate([
        { $match: { business: businessId, 'botState.stage': { $exists: true, $ne: 'idle' } } },
        { $group: { _id: '$botState.stage', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      ChatMessage.aggregate([
        {
          $match: {
            business: businessId,
            createdAt: { $gte: fromDate },
          },
        },
        { $sort: { createdAt: 1 } },
        {
          $group: {
            _id: '$contact',
            firstInboundAt: {
              $min: {
                $cond: [{ $eq: ['$direction', 'inbound'] }, '$createdAt', null],
              },
            },
            firstBotReplyAt: {
              $min: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$direction', 'outbound'] },
                      { $eq: ['$sentBy', 'bot'] },
                    ],
                  },
                  '$createdAt',
                  null,
                ],
              },
            },
          },
        },
        {
          $project: {
            responseSeconds: {
              $cond: [
                { $and: ['$firstInboundAt', '$firstBotReplyAt'] },
                {
                  $divide: [
                    { $subtract: ['$firstBotReplyAt', '$firstInboundAt'] },
                    1000,
                  ],
                },
                null,
              ],
            },
          },
        },
        { $match: { responseSeconds: { $ne: null } } },
        {
          $group: {
            _id: null,
            avgResponseSeconds: { $avg: '$responseSeconds' },
          },
        },
      ]),
    ]);

    const botHandledChats = botHandledContactsAgg[0]?.count || 0;
    const deliveryRate = botMessagesSent > 0 ? ((botMessagesSent - failedDeliveries) / botMessagesSent) * 100 : 0;
    const bookingConversionRate = botHandledChats > 0 ? (bookingsCreated / botHandledChats) * 100 : 0;
    const avgResponseSeconds = avgResponseAgg[0]?.avgResponseSeconds || 0;

    res.json({
      success: true,
      data: {
        kpis: {
          botHandledChats,
          botMessagesSent,
          failedDeliveries,
          bookingsCreated,
          deliveryRate: Number(deliveryRate.toFixed(1)),
          bookingConversionRate: Number(bookingConversionRate.toFixed(1)),
          avgResponseSeconds: Number(avgResponseSeconds.toFixed(1)),
        },
        trend: botRepliesTrend.map((item) => {
          const matchingBookings = bookingsTrend.find((booking) => booking._id === item._id);
          return {
            _id: item._id,
            botMessages: item.messages,
            failed: item.failed,
            bookings: matchingBookings?.bookings || 0,
          };
        }),
        stageDropoff,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
