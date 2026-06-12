function getUserDisplayName(user) {
  if (!user || !user.firstName) {
    return "Unknown User";
  }

  return user.firstName + " " + user.lastName;
}

module.exports = { getUserDisplayName };