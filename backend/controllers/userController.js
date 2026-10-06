const User = require('../models/User');

exports.searchUsers = async (req, res, next) => {
  try {
    const q = req.query.q ? req.query.q.trim() : '';
    const keyword = q
      ? {
          $or: [
            { fullName: { $regex: q, $options: 'i' } },
            { username: { $regex: q, $options: 'i' } },
            { email: { $regex: q, $options: 'i' } },
          ],
        }
      : {};

    // Exclude current user from search results
    const users = await User.find({ ...keyword, _id: { $ne: req.user._id } })
      .select('-password')
      .limit(20);

    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};
