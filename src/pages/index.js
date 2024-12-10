import { authService } from '../js/auth.js';
import { standardizeString } from '../js/library.js';
import { TaskItem } from '../components/task-item/index.js';
import { getPullRequests, getIssues } from '../js/github-api.js';

/** @typedef { import('../js/auth.js').UserData } User */

console.log(TaskItem.name);
console.log(standardizeString('test'));
authService.subscribeToAuthChanges(authEventHandler);

/**
 * Redirect user to the login page
 */
function redirectToLogin() {
  window.location.href = '/login';
}

/**
 * Render the page with user data
 * @param { User } user user data from auth service
 */
async function renderPage(user) {
  console.log(user);

  const data1 = await getPullRequests(user.accessToken, 'CSE-210-Team-10', 'group10-esc012');
  const data2 = await getIssues(user.accessToken, 'CSE-210-Team-10', 'group10-esc012');

  console.log(data1);
  console.log(data2);

  // const parsedIssues = {
  //   id: Number(data2[0].id),
  //   type: "issue",
  //   title: String(data2[0].title),
  //   done: true,
  //   dueDate: data2[0].updated_at instanceof Date 
  //     ? data2[0].updated_at 
  //     : new Date(data2[0].updated_at ),
  //   description: String('hi'),
  //   url: String(data2[0].url),
  //   priority: String('high'),
  //   tags: ['planning', 'architecture']
  // }
  // console.log(parsedTask);
  // console.log(parsedIssues);
  // console.log(typeof(parsedTask));
  // console.log(data2);
  // console.log(data1);
  // console.log(data1[0]);
  // console.log(data1[0].assignee);

  
  // console.log(data2);
}

/**
 * A subscriber to authService to listen to any authentication changes
 * if signed in and user is valid, render the page
 * otherwise, redirect to login page
 * @param { string } event The new state of authentication
 * @param { User } user The user data passed from authService
 */
function authEventHandler(event, user) {
  if (event === 'SIGNED_IN' && user) {
    renderPage(authService.getGithubData());
  } else if (event === 'SIGNED_OUT' || !user) {
    redirectToLogin();
  }
}