const routes = function (config) {
  const exp = {};

  // Feature 11: User/Role Management
  exp.viewUsers = async function (req, res) {
    try {
      const usersResult = await req.db.command({ usersInfo: 1 });
      const users = usersResult.users || [];

      let roles = [];
      try {
        const rolesResult = await req.db.command({ rolesInfo: 1, showBuiltinRoles: true });
        roles = rolesResult.roles || [];
      } catch {
        // rolesInfo might not be available
      }

      res.render('users', {
        title: 'Users: ' + req.dbName,
        csrfToken: req.csrfToken(),
        users,
        roles,
      });
    } catch (error) {
      req.session.error = 'Error loading users: ' + error.message;
      console.error(error);
      res.redirect('back');
    }
  };

  exp.addUser = async function (req, res) {
    if (config.options.readOnly === true) {
      req.session.error = 'Error: config.options.readOnly is set to true';
      return res.redirect('back');
    }
    try {
      const { username, password, rolesInput } = req.body;
      if (!username || !password) {
        req.session.error = 'Username and password are required';
        return res.redirect('back');
      }

      let roles = [];
      try {
        roles = JSON.parse(rolesInput || '[]');
      } catch {
        roles = [{ role: rolesInput || 'read', db: req.dbName }];
      }

      await req.db.command({
        createUser: username,
        pwd: password,
        roles,
      });

      req.session.success = `User "${username}" created!`;
      res.redirect('back');
    } catch (error) {
      req.session.error = 'Error creating user: ' + error.message;
      console.error(error);
      res.redirect('back');
    }
  };

  exp.updateUser = async function (req, res) {
    if (config.options.readOnly === true) {
      return res.status(403).json({ error: 'Read-only mode' });
    }
    try {
      const { username, password, rolesInput } = req.body;
      if (!username) {
        return res.status(400).json({ error: 'Username is required' });
      }

      const updateCmd = { updateUser: username };
      if (password) {
        updateCmd.pwd = password;
      }
      if (rolesInput) {
        try {
          updateCmd.roles = JSON.parse(rolesInput);
        } catch {
          updateCmd.roles = [{ role: rolesInput, db: req.dbName }];
        }
      }

      await req.db.command(updateCmd);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  };

  exp.deleteUser = async function (req, res) {
    if (config.options.readOnly === true) {
      req.session.error = 'Error: config.options.readOnly is set to true';
      return res.redirect('back');
    }
    if (config.options.noDelete === true) {
      req.session.error = 'Error: config.options.noDelete is set to true';
      return res.redirect('back');
    }
    try {
      const { username } = req.body;
      if (!username) {
        req.session.error = 'Username is required';
        return res.redirect('back');
      }

      await req.db.command({ dropUser: username });
      req.session.success = `User "${username}" deleted!`;
      res.redirect('back');
    } catch (error) {
      req.session.error = 'Error deleting user: ' + error.message;
      console.error(error);
      res.redirect('back');
    }
  };

  return exp;
};

export default routes;
