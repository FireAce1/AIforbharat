/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Add unique constraint on scheme_name and state combination
  pgm.addConstraint('government_schemes', 'unique_scheme_name_state', {
    unique: ['scheme_name', 'state'],
  });
};

exports.down = (pgm) => {
  pgm.dropConstraint('government_schemes', 'unique_scheme_name_state');
};
