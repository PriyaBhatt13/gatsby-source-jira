/**
 * Gatsby's Node API Interface to Jira Data Source
 * Matt Sommer
 */
//mport HttpService from './http-service';
var HttpService = require('./http-service');

const axios = require('axios');
const crypto = require('crypto');

//TODO: I don't think this is needed here...
const { createFilePath } = require('gatsby-source-filesystem');
const path = require(`path`);

exports.onCreateNode = async function onCreateNode({ node, getNode, loadNodeContent, boundActionCreators },pluginOptions) {
    const { createNode, createParentChildLink } = boundActionCreators;
    // Transform data here
}

exports.sourceNodes = async ({ boundActionCreators }, configOptions) => {

    // Delete empty 'plugins' array config option generated by GatsbyJS
    delete configOptions.plugins;

    // Log the host configuration
    console.log("Plugin Jira Source: Config Settings:", configOptions.host);

    var httpService = new HttpService(configOptions.host);

    const { createNode } = boundActionCreators;

    const fetchTasks = () => httpService.jiraQuery('', 0)
        .then((response) => {
            return response;
        })
        .then((response) => {
            var issues = axios.all(httpService.queryArray(configOptions.host, response.data.total))
                .then(function (results) {
                    let temp = results.map(r => r.data.issues);
                    temp.push(response.data.issues);
                    var merged = [].concat.apply([], temp);
                    return merged;
                });
            return issues;
        });

    // Fetch all the Jira Issues
    const res = await fetchTasks();

    console.log("Jira Issues returned: " + res.length);

    // When results retrieved create Nodes for each entity
    console.log("Plugin Jira Source: Creating source nodes")
    res.map((inputTask, i) => {

        //GraphQL node names apparently cannot start with a number...
        // https://github.com/graphql/graphql-js/blob/master/src/utilities/assertValidName.js#L14
        var str = JSON.stringify(inputTask);
        str = str.replace(/16x16/g,"size16x16");
        str = str.replace(/24x24/g,"size24x24");
        str = str.replace(/32x32/g,"size32x32");
        str = str.replace(/48x48/g,"size48x48");
        // Gatsby already uses the fields attribute
        // I'm not sur what it's used for buy maybe it can be integrated with?
        str = str.replace(/fields/g,"jiraFields");
        var task = JSON.parse(str);

        // Create your node object
        const taskNode = {
            // Required fields
            id: '${i}',
            parent: '__SOURCE__',
            internal: {
                type: 'JiraIssue', // name of the graphQL query --> allTask {}
            },
            children: [],
            id: task.id,
            key: task.key,
            type: task.jiraFields.issuetype.name,
            summary: task.jiraFields.summary,
            status: task.jiraFields.status.name,
            labels: task.jiraFields.labels,
            components: task.jiraFields.components,
            project: task.jiraFields.project.name,
            epic: task.jiraFields.customfield_10009,
            jiraIssue: task,
            // fieldsList: task.fields, // their is a field called 48x48 and for some reason Gatsby doesn't like that name...
            slug: HttpService.sanitizeURLPath(task.jiraFields.project.name) + "/" + HttpService.sanitizeURLPath(task.jiraFields.summary),
        }

        // Get content digest of node. (Required field)
        const contentDigest = crypto
            .createHash('md5')
            .update(JSON.stringify(taskNode))
            .digest('hex');

        // Add the content digest to the node
        taskNode.internal.contentDigest = contentDigest;

        // Create a Node using Gatsby's API
        createNode(taskNode);
    });

    return;
}