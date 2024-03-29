const { Dates, Files } = require('../models');
const sequelize = require('sequelize');
const Op = sequelize.Op;
const { getTodaysDate } = require('./getTodaysDate');

const writeEmail = async (recipient) => {
    var emailHtml = `<b style='white-space: pre-line'>Good morning ${recipient.slice(0,1).toUpperCase() + (recipient.split('@'))[0].slice(1)}!<br/><br/>` +
        `Below is your daily critical timeline update:<br/><br/>` +
        `<a href=${process.env.URL}>You can also view it on the web at ${process.env.URL}!</a><br/><br/>`
    
    const closedFiles = await Files.findAll({
        where: { [Op.not]: [{ status: 'Open' }] }
    });

    var closedFileNumbers = []
    for(const file of closedFiles) {
        closedFileNumbers.push(file.dataValues.fileNumber)
    }

    const today = getTodaysDate();

    const isPastDue = await Dates.findAll({
        where: {
            date: { [Op.and]: { [Op.between]: ['1000-01-01', today], [Op.not]: today } },
            isClosed: 0,
            fileNumber: {
                [Op.notIn]: closedFileNumbers
            }
        },
        order: [['date', 'ASC']]
    });

    const isToday = await Dates.findAll({
        where: {
            date: { [Op.between]: [today, today] },
            isClosed: 0,
            fileNumber: {
                [Op.notIn]: closedFileNumbers
            }
        },
        order: [['date', 'ASC']]
    });

    const isUpcoming = await Dates.findAll({
        where: {
            date: { [Op.and]: { [Op.between]: [today, '9999-12-31'], [Op.not]: today } },
            isClosed: 0,
            fileNumber: {
                [Op.notIn]: closedFileNumbers
            }
        },
        order: [['date', 'ASC']]
    });

    for( const [index, group] of [isToday, isPastDue, isUpcoming].entries() ) {
        const header = `<br/><br/><table cellspacing=0 border='1' style='border:1px solid black; max-width=850px;'>
            <tr style='background-color:#88AACC;'>
                <th align='left' style='border:1px solid black; width:60px; white-space:nowrap;'>Date</th>
                <th align='left' style='border:1px solid black; width:100px; white-space:nowrap;'>Event</th>
                <th align='left' style='border:1px solid black; width:50px; white-space:nowrap;'>File No.</th>
                <th align='left' style='border:1px solid black; width:540px; white-space:nowrap;'>File Reference</th>
                <th align='left' style='border:1px solid black; width:100px; white-space:nowrap;'>Closing Agent?</th>
            </tr>`
        if(index === 0) {
            emailHtml += `<b style='white-space: pre-line'>---------- TODAY ----------</b>${header}`
        }
        if(index === 1) {
            emailHtml += `<b style='white-space: pre-line'>---------- PAST DUE ----------</b>${header}`
        }
        if(index === 2) {
            emailHtml += `<b style='white-space: pre-line'>---------- UPCOMING ----------</b>${header}`
        }
        
        if(group[0] === undefined) {
            emailHtml += `<tr><td colspan=5 style='background-color:#CCE7FF;'><b>No Dates found for this timeframe.</b></td></tr></table><br/>`
            continue;
        }

        for(const [index, date] of group.entries() ) {
            const fileInfo = await Files.findOne({
                where: { fileNumber: date.dataValues.fileNumber }
            })

            if(fileInfo) {
                for(const info in fileInfo.dataValues) {
                    if(info === 'status')
                        date.dataValues['isFileClosed'] = fileInfo.dataValues[info]
                    else
                        date.dataValues[`${info}`] = fileInfo.dataValues[info]
                }
            }

            emailHtml += `<tr style='${(index % 2 === 0) ? 'background-color:#CCE7FF' : 'background-color:#AACCEE'};'>
                <td valign='center' style='border:1px solid black; white-space:nowrap;'>${date.dataValues.date.slice(-5)}-${date.dataValues.date.slice(2,4)}</td>
                <td valign='center' style='border:1px solid black; white-space:nowrap;'>${date.dataValues.type === 'Escrow' ? date.dataValues.prefix : ''}${date.dataValues.type}</td>
                <td valign='center' style='border:1px solid black; white-space:nowrap;'>${date.dataValues.fileNumber}</td>
                <td valign='center' style='border:1px solid black; max-width: 540px; white-space:nowrap; overflow:hidden; text-overflow: ellipsis;'>${date.dataValues.fileRef}</td>
                <td valign='center' style='border:1px solid black; max-width: 100px; white-space:nowrap;'>${JSON.parse(date.dataValues.roles).isClosingAgent ? 'Yes' : 'No'}</td>
            </tr>`
        }
        emailHtml += `</table><br/>`;
    }
    emailHtml += '</b>';

    return emailHtml;
}

module.exports = { writeEmail };
